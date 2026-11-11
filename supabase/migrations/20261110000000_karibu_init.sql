-- Karibu TV schema for Supabase (BUILD_SPEC sections 5–8, adapted from PocketBase).
-- Hosts sign in with Supabase Auth. TVs never sign in: they hold a device_key + secret
-- and talk to SECURITY DEFINER functions (pair_*, tv_*), so RLS never exposes data to them.

create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------------ helpers
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ----------------------------------------------------------------- profiles
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null default '',
  whatsapp    text not null default '',
  country     text not null default 'KE' check (country in ('KE', 'TZ', 'UG', 'RW', 'other')),
  plan        text not null default 'free' check (plan in ('free', 'pro')),
  plan_until  timestamptz,
  pro_tvs     int not null default 1 check (pro_tvs >= 0),
  trial       boolean not null default false,
  onboarding  jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- New hosts start with a 30-day Pro trial (3 TVs).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, whatsapp, country, plan, plan_until, pro_tvs, trial)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'whatsapp', ''),
    case when new.raw_user_meta_data ->> 'country' in ('KE', 'TZ', 'UG', 'RW', 'other')
         then new.raw_user_meta_data ->> 'country' else 'KE' end,
    'pro', now() + interval '30 days', 3, true
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Plan for a user: Pro while plan = 'pro' and plan_until is in the future.
create or replace function public.plan_info(uid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'pro', coalesce(p.plan = 'pro' and p.plan_until > now(), false),
    'max_tvs', case when p.plan = 'pro' and p.plan_until > now() then greatest(1, p.pro_tvs) else 1 end,
    'max_properties', case when p.plan = 'pro' and p.plan_until > now() then 50 else 1 end
  )
  from public.profiles p where p.id = uid
$$;

create or replace function public.is_pro(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((public.plan_info(uid) ->> 'pro')::boolean, false)
$$;

-- --------------------------------------------------------------- properties
create table public.properties (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name               text not null check (char_length(name) between 1 and 80),
  tagline            text not null default '',
  area               text not null default '',
  timezone           text not null default 'Africa/Nairobi',
  checkin_time       text not null default '14:00',
  checkout_time      text not null default '11:00',
  quiet_start        text not null default '22:00',
  quiet_end          text not null default '07:00',
  amenities          jsonb not null default '["wifi","tv"]'::jsonb,
  house_rules        jsonb not null default '[]'::jsonb,
  checkout_steps     jsonb not null default '[]'::jsonb,
  max_guests         int not null default 0 check (max_guests between 0 and 99),
  host_name          text not null default '',
  host_contact       text not null default '',
  welcome_title      text not null default '',
  welcome_note       text not null default '',
  generic_title      text not null default '',
  generic_note       text not null default '',
  thankyou_line      text not null default '',
  contact_title      text not null default '',
  contact_line       text not null default '',
  wifi_ssid          text not null default '',
  wifi_password      text not null default '',
  wifi_security      text not null default 'WPA' check (wifi_security in ('WPA', 'WEP', 'nopass')),
  show_wifi_password boolean not null default true,
  layout             text not null default 'classic' check (layout in ('classic', 'mirror', 'fullphoto', 'spotlight', 'minimal')),
  theme              text not null default 'karibu' check (theme in ('karibu', 'maroon', 'midnight', 'teal', 'forest', 'charcoal', 'plum', 'espresso', 'ocean', 'custom')),
  color_bg           text not null default '',
  color_accent       text not null default '',
  photo_welcome      text not null default '',
  photo_checkout     text not null default '',
  photo_generic      text not null default '',
  logo               text not null default '',
  logo_position      text not null default 'header' check (logo_position in ('header', 'wifi')),
  weather_enabled    boolean not null default false,
  weather_place      text not null default '',
  weather_lat        double precision,
  weather_lon        double precision,
  weather_json       jsonb,
  weather_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index properties_owner_idx on public.properties (owner_id);
create trigger properties_touch before update on public.properties for each row execute function public.touch_updated_at();

-- Plan limits and Pro-only fields, enforced in the database (never only in the UI).
create or replace function public.properties_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  info jsonb := public.plan_info(new.owner_id);
  pro boolean := coalesce((info ->> 'pro')::boolean, false);
  n int;
begin
  if tg_op = 'INSERT' then
    select count(*) into n from public.properties where owner_id = new.owner_id;
    if n >= coalesce((info ->> 'max_properties')::int, 1) then
      raise exception 'plan_limit: The Free plan includes 1 property. Upgrade to Pro to add more.' using errcode = 'P0001';
    end if;
  else
    if new.owner_id <> old.owner_id then
      raise exception 'You can''t change the owner.' using errcode = '42501';
    end if;
  end if;
  if not pro then
    if new.weather_enabled and (tg_op = 'INSERT' or not old.weather_enabled) then
      raise exception 'pro_required: Weather on the TV is a Pro feature.' using errcode = 'P0001';
    end if;
    if new.logo <> '' and (tg_op = 'INSERT' or new.logo <> old.logo) then
      raise exception 'pro_required: Your own logo is a Pro feature.' using errcode = 'P0001';
    end if;
  end if;
  -- New weather place: clear the cached forecast and coordinates so the weather function refetches.
  if tg_op = 'UPDATE' and new.weather_place <> old.weather_place then
    new.weather_lat := null; new.weather_lon := null; new.weather_json := null; new.weather_at := null;
  end if;
  return new;
end $$;
create trigger properties_guard before insert or update on public.properties for each row execute function public.properties_guard();

-- ---------------------------------------------------------------- calendars
create table public.calendars (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties (id) on delete cascade,
  provider     text not null default 'ical' check (provider in ('airbnb', 'booking', 'vrbo', 'google', 'ical', 'pms')),
  label        text not null default '',
  url          text not null check (url ~* '^https?://'),
  last_synced  timestamptz,
  last_status  text not null default 'pending' check (last_status in ('ok', 'error', 'pending')),
  last_error   text not null default '',
  event_count  int not null default 0,
  created_at   timestamptz not null default now()
);
create index calendars_property_idx on public.calendars (property_id);

create or replace function public.calendars_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_pro((select owner_id from public.properties where id = new.property_id)) then
    raise exception 'pro_required: Calendar sync is a Pro feature.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger calendars_guard before insert on public.calendars for each row execute function public.calendars_guard();

-- -------------------------------------------------------------------- stays
create table public.stays (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties (id) on delete cascade,
  first_name   text not null default '' check (char_length(first_name) <= 40),
  checkin      date not null,
  checkout     date not null,
  source       text not null default 'manual' check (source in ('manual', 'ical', 'email')),
  calendar_id  uuid references public.calendars (id) on delete set null,
  external_id  text not null default '',
  note         text not null default '' check (char_length(note) <= 500),
  cancelled    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (checkout > checkin)
);
create unique index stays_external_uidx on public.stays (property_id, external_id) where external_id <> '';
create index stays_dates_idx on public.stays (property_id, checkin, checkout);
create trigger stays_touch before update on public.stays for each row execute function public.touch_updated_at();

-- Removing a calendar removes its future iCal stays (manual stays that took over a UID stay).
create or replace function public.calendars_before_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.stays where calendar_id = old.id and source = 'ical' and checkout >= current_date;
  return old;
end $$;
create trigger calendars_before_delete before delete on public.calendars for each row execute function public.calendars_before_delete();

-- ------------------------------------------------------------------ devices
create table public.devices (
  id           uuid primary key default gen_random_uuid(),
  device_key   text not null unique check (char_length(device_key) between 16 and 64),
  secret_hash  text not null default '',
  owner_id     uuid references auth.users (id) on delete set null,
  property_id  uuid references public.properties (id) on delete set null,
  name         text not null default 'TV',
  channel      uuid not null default gen_random_uuid(),
  last_seen    timestamptz,
  opened_at    timestamptz,
  app_version  text not null default '',
  screen_w     int,
  screen_h     int,
  created_at   timestamptz not null default now()
);
create index devices_owner_idx on public.devices (owner_id);
create index devices_property_idx on public.devices (property_id);

-- ------------------------------------------------------------ pairing codes
create table public.pairing_codes (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  device_key    text not null,
  poll_secret   text not null,
  expires       timestamptz not null,
  status        text not null default 'waiting' check (status in ('waiting', 'linked', 'collected', 'expired')),
  device_id     uuid references public.devices (id) on delete cascade,
  device_secret text not null default '',
  created_at    timestamptz not null default now()
);
create index pairing_codes_device_idx on public.pairing_codes (device_key, created_at);

-- ------------------------------------------------- payments, leads, PMS asks
create table public.payments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  provider      text not null check (provider in ('mpesa', 'card')),
  amount        numeric not null,
  currency      text not null check (currency in ('KES', 'USD')),
  period        text not null check (period in ('month', 'year')),
  tvs           int not null default 1,
  status        text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled')),
  provider_ref  text not null default '',
  receipt       text not null default '',
  raw           jsonb,
  created_at    timestamptz not null default now()
);

create table public.leads (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  email       text not null default '' check (char_length(email) <= 120),
  whatsapp    text not null default '' check (char_length(whatsapp) <= 20),
  city        text not null default '' check (char_length(city) <= 60),
  country     text not null default '' check (char_length(country) <= 40),
  tv_brand    text not null default '' check (tv_brand in ('', 'TCL', 'Hisense', 'Vitron', 'Skyworth', 'Syinix', 'Sony', 'Xiaomi', 'Samsung', 'LG', 'other')),
  tv_count    int not null default 0 check (tv_count between 0 and 999),
  message     text not null default '' check (char_length(message) <= 1000),
  source      text not null default '' check (char_length(source) <= 200),
  created_at  timestamptz not null default now(),
  check (email <> '' or whatsapp <> '')
);

create table public.pms_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  pms         text not null check (char_length(pms) between 1 and 80),
  details     text not null default '' check (char_length(details) <= 500),
  created_at  timestamptz not null default now()
);

-- ===================================================================== RLS
alter table public.profiles      enable row level security;
alter table public.properties    enable row level security;
alter table public.calendars     enable row level security;
alter table public.stays         enable row level security;
alter table public.devices       enable row level security;
alter table public.pairing_codes enable row level security;
alter table public.payments      enable row level security;
alter table public.leads         enable row level security;
alter table public.pms_requests  enable row level security;

create policy "own profile" on public.profiles for select using (id = auth.uid());
create policy "update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "delete own profile" on public.profiles for delete using (id = auth.uid());
-- Hosts may edit only these columns; plan, plan_until, pro_tvs and trial are server-only.
revoke update on public.profiles from anon, authenticated;
grant update (name, whatsapp, country, onboarding) on public.profiles to authenticated;

create policy "own properties" on public.properties for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "own calendars" on public.calendars for all
  using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()));
-- Sync status is written by the ical-sync function (service role), not by hosts.
revoke update on public.calendars from anon, authenticated;
grant update (label, url, provider) on public.calendars to authenticated;

create policy "own stays" on public.stays for all
  using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()));

create policy "own devices" on public.devices for select using (owner_id = auth.uid());
revoke insert, update, delete on public.devices from anon, authenticated;
revoke all on public.pairing_codes from anon, authenticated;

create policy "own payments" on public.payments for select using (user_id = auth.uid());
revoke insert, update, delete on public.payments from anon, authenticated;

create policy "anyone can send a lead" on public.leads for insert to anon, authenticated with check (true);
revoke select, update, delete on public.leads from anon, authenticated;

create policy "own pms requests" on public.pms_requests for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================ TV functions
create or replace function public.random_token(n_bytes int) returns text
language sql volatile as $$ select encode(extensions.gen_random_bytes(n_bytes), 'hex') $$;

create or replace function public.hash_secret(s text) returns text
language sql immutable as $$ select encode(extensions.digest(s, 'sha256'), 'hex') $$;

-- TV asks for a pairing code (BUILD_SPEC 8.2).
create or replace function public.pair_start(p_device_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_secret text := public.random_token(16);
  v_expires timestamptz := now() + interval '10 minutes';
  recent int;
  i int;
begin
  if p_device_key !~ '^[A-Za-z0-9_-]{16,64}$' then
    raise exception 'Invalid device key.' using errcode = '22023';
  end if;
  select count(*) into recent from public.pairing_codes
   where device_key = p_device_key and created_at > now() - interval '1 minute';
  if recent >= 5 then
    raise exception 'rate_limited: Too many requests. Try again in a minute.' using errcode = 'P0001';
  end if;
  update public.pairing_codes set status = 'expired' where device_key = p_device_key and status = 'waiting';
  for attempt in 1..10 loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(alphabet, 1 + (get_byte(extensions.gen_random_bytes(1), 0) % length(alphabet)), 1);
    end loop;
    exit when not exists (select 1 from public.pairing_codes where code = v_code);
    v_code := null;
  end loop;
  if v_code is null then raise exception 'Could not create a code. Try again.'; end if;
  insert into public.pairing_codes (code, device_key, poll_secret, expires) values (v_code, p_device_key, v_secret, v_expires);
  return jsonb_build_object('code', v_code, 'expires', v_expires, 'poll_secret', v_secret);
end $$;

-- TV polls; returns its device secret exactly once after the host links it.
create or replace function public.pair_status(p_device_key text, p_poll_secret text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.pairing_codes;
begin
  select * into r from public.pairing_codes where device_key = p_device_key and poll_secret = p_poll_secret;
  if not found then return jsonb_build_object('status', 'unknown'); end if;
  if r.status = 'waiting' and r.expires < now() then
    update public.pairing_codes set status = 'expired' where id = r.id;
    return jsonb_build_object('status', 'expired');
  end if;
  if r.status = 'linked' then
    update public.pairing_codes set status = 'collected', device_secret = '' where id = r.id;
    return jsonb_build_object('status', 'linked', 'device_secret', r.device_secret);
  end if;
  return jsonb_build_object('status', r.status);
end $$;

-- Host links a TV to a property with the code shown on screen.
create or replace function public.pair_link(p_code text, p_property uuid, p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r public.pairing_codes;
  info jsonb;
  d public.devices;
  v_secret text := public.random_token(24);
  n int;
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if uid is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  select * into r from public.pairing_codes where code = v_code and status = 'waiting';
  if not found then raise exception 'That code is not valid. Check the code on the TV and try again.' using errcode = 'P0002'; end if;
  if r.expires < now() then raise exception 'That code has expired. The TV will show a new one.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.properties where id = p_property and owner_id = uid) then
    raise exception 'Choose one of your properties.' using errcode = '42501';
  end if;
  select * into d from public.devices where device_key = r.device_key;
  info := public.plan_info(uid);
  select count(*) into n from public.devices where owner_id = uid and (d.id is null or id <> d.id);
  if n >= (info ->> 'max_tvs')::int then
    raise exception 'plan_limit: %', case when (info ->> 'pro')::boolean
      then format('Your plan covers %s TVs. Add more TVs on the Billing page.', info ->> 'max_tvs')
      else 'The Free plan includes 1 TV. Upgrade to Pro to pair more.' end using errcode = 'P0001';
  end if;
  insert into public.devices (device_key, secret_hash, owner_id, property_id, name)
  values (r.device_key, public.hash_secret(v_secret), uid, p_property, coalesce(nullif(left(trim(p_name), 40), ''), 'TV'))
  on conflict (device_key) do update set
    secret_hash = excluded.secret_hash, owner_id = excluded.owner_id, property_id = excluded.property_id,
    name = excluded.name, channel = gen_random_uuid()
  returning * into d;
  update public.pairing_codes set status = 'linked', device_id = d.id, device_secret = v_secret where id = r.id;
  return jsonb_build_object('id', d.id, 'name', d.name, 'property_id', d.property_id);
end $$;

create or replace function public.device_for(p_device_key text, p_secret text) returns public.devices
language sql stable security definer set search_path = public as $$
  select * from public.devices
   where device_key = p_device_key and secret_hash <> '' and secret_hash = public.hash_secret(p_secret)
$$;

-- Everything the TV needs to render; the screen state itself is computed on the TV
-- from these stays with the shared logic in apps/web/src/lib/screen.ts.
create or replace function public.tv_screen(p_device_key text, p_secret text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  d public.devices;
  p public.properties;
  info jsonb;
  rank int;
begin
  d := public.device_for(p_device_key, p_secret);
  if d.id is null then return jsonb_build_object('error', 'unpaired'); end if;
  if d.property_id is null then return jsonb_build_object('error', 'unpaired'); end if;
  select * into p from public.properties where id = d.property_id;
  info := public.plan_info(p.owner_id);
  select count(*) into rank from public.devices where owner_id = d.owner_id and created_at < d.created_at;
  return jsonb_build_object(
    'device', jsonb_build_object('id', d.id, 'name', d.name, 'channel', d.channel),
    'plan', info,
    'restricted', rank >= (info ->> 'max_tvs')::int,
    'property', to_jsonb(p) - 'owner_id' - 'weather_lat' - 'weather_lon',
    'stays', coalesce((
      select jsonb_agg(jsonb_build_object('first_name', s.first_name, 'checkin', s.checkin, 'checkout', s.checkout) order by s.checkin)
        from public.stays s
       where s.property_id = p.id and not s.cancelled
         and s.checkin <= current_date + 2 and s.checkout >= current_date - 2
    ), '[]'::jsonb),
    'server_time', now()
  );
end $$;

create or replace function public.tv_heartbeat(p_device_key text, p_secret text, p_app_version text, p_w int, p_h int, p_opened boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d public.devices;
begin
  d := public.device_for(p_device_key, p_secret);
  if d.id is null then return jsonb_build_object('ok', false, 'error', 'unpaired'); end if;
  update public.devices set
    last_seen = now(),
    opened_at = case when p_opened then now() else opened_at end,
    app_version = left(coalesce(p_app_version, ''), 20),
    screen_w = p_w, screen_h = p_h
  where id = d.id;
  return jsonb_build_object('ok', true, 'server_time', now(), 'paired', d.property_id is not null);
end $$;

-- Host-side device management.
create or replace function public.device_update(p_device uuid, p_name text default null, p_property uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d public.devices;
begin
  select * into d from public.devices where id = p_device and owner_id = auth.uid();
  if not found then raise exception 'That TV isn''t yours.' using errcode = '42501'; end if;
  if p_property is not null and not exists (select 1 from public.properties where id = p_property and owner_id = auth.uid()) then
    raise exception 'Choose one of your properties.' using errcode = '42501';
  end if;
  if p_name is not null and trim(p_name) = '' then raise exception 'Give the TV a name, e.g. Living room.'; end if;
  update public.devices set
    name = coalesce(left(trim(p_name), 40), name),
    property_id = coalesce(p_property, property_id)
  where id = d.id returning * into d;
  return jsonb_build_object('id', d.id, 'name', d.name, 'property_id', d.property_id);
end $$;

create or replace function public.device_unlink(p_device uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.devices set owner_id = null, property_id = null, secret_hash = '', channel = gen_random_uuid()
   where id = p_device and owner_id = auth.uid();
  if not found then raise exception 'That TV isn''t yours.' using errcode = '42501'; end if;
end $$;

revoke all on function public.pair_start(text), public.pair_status(text, text), public.tv_screen(text, text),
  public.tv_heartbeat(text, text, text, int, int, boolean), public.device_for(text, text),
  public.pair_link(text, uuid, text), public.device_update(uuid, text, uuid), public.device_unlink(uuid),
  public.plan_info(uuid), public.is_pro(uuid), public.random_token(int), public.hash_secret(text) from public;
grant execute on function public.pair_start(text), public.pair_status(text, text), public.tv_screen(text, text),
  public.tv_heartbeat(text, text, text, int, int, boolean) to anon, authenticated;
grant execute on function public.pair_link(text, uuid, text), public.device_update(uuid, text, uuid),
  public.device_unlink(uuid), public.plan_info(uuid) to authenticated;

-- ============================================== live updates to TVs (< 10 s)
-- Broadcast a "refresh" on each affected TV's private-by-obscurity channel (tv-<uuid>).
-- Best effort: if Realtime is unavailable the TV still polls every 20 s.
create or replace function public.notify_tvs() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_property uuid;
  ch uuid;
begin
  if tg_table_name = 'properties' then v_property := coalesce(new.id, old.id);
  elsif tg_table_name = 'stays' then v_property := coalesce(new.property_id, old.property_id);
  end if;
  begin
    if tg_table_name = 'devices' then
      if old.channel is not null then
        perform realtime.send(jsonb_build_object('at', now()), 'refresh', 'tv-' || old.channel::text, false);
      end if;
    else
      for ch in select channel from public.devices where property_id = v_property loop
        perform realtime.send(jsonb_build_object('at', now()), 'refresh', 'tv-' || ch::text, false);
      end loop;
    end if;
  exception when others then
    null;
  end;
  return coalesce(new, old);
end $$;
create trigger properties_notify after insert or update or delete on public.properties for each row execute function public.notify_tvs();
create trigger stays_notify after insert or update or delete on public.stays for each row execute function public.notify_tvs();
create trigger devices_notify after update of property_id, secret_hash, channel on public.devices for each row execute function public.notify_tvs();

-- ================================================================= storage
-- Photos and logos: public read; hosts write only under their own user-id folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-media', 'property-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

create policy "hosts upload own media" on storage.objects for insert to authenticated
  with check (bucket_id = 'property-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "hosts update own media" on storage.objects for update to authenticated
  using (bucket_id = 'property-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "hosts delete own media" on storage.objects for delete to authenticated
  using (bucket_id = 'property-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================== retention
-- BUILD_SPEC 8.5: daily at 03:00 UTC. Skipped quietly if pg_cron isn't available.
create or replace function public.karibu_retention() returns void
language sql security definer set search_path = public as $$
  delete from public.stays where checkout < current_date - 30;
  delete from public.pairing_codes where created_at < now() - interval '1 day';
  delete from public.devices where property_id is null and owner_id is null
    and coalesce(last_seen, created_at) < now() - interval '30 days';
$$;
revoke all on function public.karibu_retention() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('karibu-retention', '0 3 * * *', 'select public.karibu_retention()');
exception when others then
  raise notice 'pg_cron not available; schedule public.karibu_retention() yourself.';
end $$;

-- ====================================================== dashboard realtime
-- Live TV status, bookings and sync results in the dashboard (RLS still applies to subscribers).
do $$
begin
  alter publication supabase_realtime add table public.devices, public.stays, public.calendars;
exception when others then
  raise notice 'supabase_realtime publication not available; dashboard falls back to refresh.';
end $$;
