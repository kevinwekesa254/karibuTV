-- Karibu TV v3: super admin, host notifications, cleaning schedules, guest-guide insights,
-- profile photo / business logo, East Africa countries, pricing source of truth, audit log.
-- Run after 20261110000000_karibu_init.sql and 20261111000000_karibu_templates.sql. Safe to re-run.

-- ---------------------------------------------------------------- profiles
alter table public.profiles
  add column if not exists role text not null default 'host',
  add column if not exists avatar text not null default '',
  add column if not exists business_name text not null default '',
  add column if not exists business_logo text not null default '',
  add column if not exists sub_started_at timestamptz;          -- first paid month (drives intro pricing)
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('host', 'admin'));
alter table public.profiles drop constraint if exists profiles_country_check;
alter table public.profiles add constraint profiles_country_check
  check (country in ('KE', 'TZ', 'UG', 'RW', 'BI', 'SS', 'ET', 'SO', 'CD', 'other'));
alter table public.profiles drop constraint if exists profiles_text_lengths;
alter table public.profiles add constraint profiles_text_lengths
  check (char_length(business_name) <= 80 and char_length(avatar) <= 300 and char_length(business_logo) <= 300);

-- Hosts may edit their own name, WhatsApp, country, onboarding, photo and business details.
-- role, plan, plan_until, pro_tvs, trial and sub_started_at stay server-only.
revoke update on public.profiles from anon, authenticated;
grant update (name, whatsapp, country, onboarding, avatar, business_name, business_logo) on public.profiles to authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, whatsapp, country, plan, plan_until, pro_tvs, trial)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'name', ''), 80),
    left(coalesce(new.raw_user_meta_data ->> 'whatsapp', ''), 20),
    case when new.raw_user_meta_data ->> 'country' in ('KE', 'TZ', 'UG', 'RW', 'BI', 'SS', 'ET', 'SO', 'CD', 'other')
         then new.raw_user_meta_data ->> 'country' else 'KE' end,
    'pro', now() + interval '30 days', 3, true
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- ------------------------------------------------------------------ admins
-- An admin is a profile with role = 'admin' whose session passed two-step verification (aal2).
create or replace function public.is_admin(uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = uid and role = 'admin')
$$;

create or replace function public.admin_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin(auth.uid()) and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;
grant execute on function public.is_admin(uuid), public.admin_ok() to authenticated;

create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  actor      uuid references auth.users (id) on delete set null,
  action     text not null,
  target     text not null default '',
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
drop policy if exists "admins read audit" on public.audit_log;
create policy "admins read audit" on public.audit_log for select using (public.admin_ok());
revoke insert, update, delete on public.audit_log from anon, authenticated;

create or replace function public.audit(p_action text, p_target text, p_detail jsonb) returns void
language sql security definer set search_path = public as $$
  insert into public.audit_log (actor, action, target, detail) values (auth.uid(), p_action, p_target, coalesce(p_detail, '{}'::jsonb))
$$;
revoke all on function public.audit(text, text, jsonb) from public, anon, authenticated;

-- Admins can read everything hosts own (read-only through RLS; changes go through audited functions).
drop policy if exists "admins read profiles" on public.profiles;
create policy "admins read profiles" on public.profiles for select using (public.admin_ok());
drop policy if exists "admins read properties" on public.properties;
create policy "admins read properties" on public.properties for select using (public.admin_ok());
drop policy if exists "admins read devices" on public.devices;
create policy "admins read devices" on public.devices for select using (public.admin_ok());
drop policy if exists "admins read payments" on public.payments;
create policy "admins read payments" on public.payments for select using (public.admin_ok());
drop policy if exists "admins read pms" on public.pms_requests;
create policy "admins read pms" on public.pms_requests for select using (public.admin_ok());
grant select on public.leads to authenticated;
drop policy if exists "admins read leads" on public.leads;
create policy "admins read leads" on public.leads for select to authenticated using (public.admin_ok());

-- Hosts with emails and counts, for the admin hosts table.
create or replace function public.admin_hosts() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.admin_ok() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'email', u.email, 'whatsapp', p.whatsapp, 'country', p.country, 'role', p.role,
      'business_name', p.business_name, 'plan', p.plan, 'plan_until', p.plan_until, 'pro_tvs', p.pro_tvs, 'trial', p.trial,
      'created_at', p.created_at,
      'properties', (select count(*) from public.properties x where x.owner_id = p.id),
      'tvs', (select count(*) from public.devices d where d.owner_id = p.id and d.property_id is not null),
      'tvs_online', (select count(*) from public.devices d where d.owner_id = p.id and d.last_seen > now() - interval '10 minutes'))
      order by p.created_at desc)
    from public.profiles p join auth.users u on u.id = p.id), '[]'::jsonb);
end $$;

create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.admin_ok() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'hosts', (select count(*) from public.profiles where role = 'host'),
    'hosts_7d', (select count(*) from public.profiles where role = 'host' and created_at > now() - interval '7 days'),
    'pro', (select count(*) from public.profiles where plan = 'pro' and plan_until > now() and not trial),
    'trials', (select count(*) from public.profiles where trial and plan_until > now()),
    'properties', (select count(*) from public.properties),
    'tvs', (select count(*) from public.devices where property_id is not null),
    'tvs_online', (select count(*) from public.devices where last_seen > now() - interval '10 minutes'),
    'leads_7d', (select count(*) from public.leads where created_at > now() - interval '7 days'),
    'guide_scans_7d', (select count(*) from public.guide_events where kind = 'view' and created_at > now() - interval '7 days'));
end $$;

-- Set a host's plan. Audited.
create or replace function public.admin_set_plan(p_user uuid, p_plan text, p_until timestamptz, p_tvs int, p_trial boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_ok() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_plan not in ('free', 'pro') or p_tvs < 0 or p_tvs > 500 then raise exception 'Invalid plan.' using errcode = '22023'; end if;
  update public.profiles set plan = p_plan, plan_until = p_until, pro_tvs = p_tvs, trial = p_trial,
    sub_started_at = case when p_plan = 'pro' and not p_trial then coalesce(sub_started_at, now()) else sub_started_at end
  where id = p_user;
  perform public.audit('set_plan', p_user::text, jsonb_build_object('plan', p_plan, 'until', p_until, 'tvs', p_tvs, 'trial', p_trial));
end $$;

grant execute on function public.admin_hosts(), public.admin_stats(), public.admin_set_plan(uuid, text, timestamptz, int, boolean) to authenticated;

-- ----------------------------------------------------- host notifications
create table if not exists public.host_notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete cascade,   -- null = every host
  title      text not null check (char_length(title) between 1 and 80),
  body       text not null default '' check (char_length(body) <= 500),
  link       text not null default '' check (link = '' or link ~ '^(/|https://)'),
  tone       text not null default 'info' check (tone in ('info', 'success', 'warning')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists host_notifications_user_idx on public.host_notifications (user_id, created_at desc);
create table if not exists public.notification_reads (
  user_id         uuid not null references auth.users (id) on delete cascade default auth.uid(),
  notification_id uuid not null references public.host_notifications (id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (user_id, notification_id)
);
alter table public.host_notifications enable row level security;
alter table public.notification_reads enable row level security;
drop policy if exists "hosts read their notifications" on public.host_notifications;
create policy "hosts read their notifications" on public.host_notifications for select
  using (user_id = auth.uid() or user_id is null or public.admin_ok());
revoke insert, update, delete on public.host_notifications from anon, authenticated;
drop policy if exists "own reads" on public.notification_reads;
create policy "own reads" on public.notification_reads for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.admin_notify(p_user uuid, p_title text, p_body text, p_link text, p_tone text default 'info')
returns uuid language plpgsql security definer set search_path = public as $$
declare nid uuid;
begin
  if not public.admin_ok() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.host_notifications (user_id, title, body, link, tone, created_by)
  values (p_user, trim(p_title), trim(coalesce(p_body, '')), trim(coalesce(p_link, '')), coalesce(p_tone, 'info'), auth.uid())
  returning id into nid;
  perform public.audit('notify', coalesce(p_user::text, 'all'), jsonb_build_object('title', p_title));
  return nid;
end $$;
grant execute on function public.admin_notify(uuid, text, text, text, text) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.host_notifications;
exception when others then null; end $$;

-- -------------------------------------------------------- cleaning schedule
-- [{ "day": "tue", "time": "10:00", "note": "Fresh towels and bedding" }], shown on the TV.
alter table public.properties
  add column if not exists cleaning jsonb not null default '[]'::jsonb,
  add column if not exists show_cleaning boolean not null default true;
alter table public.properties drop constraint if exists properties_cleaning_check;
alter table public.properties add constraint properties_cleaning_check
  check (jsonb_typeof(cleaning) = 'array' and jsonb_array_length(cleaning) <= 7);

-- -------------------------------------------- guest guide insights (AI tab)
create table if not exists public.guide_events (
  id          bigint generated always as identity primary key,
  property_id uuid not null references public.properties (id) on delete cascade,
  kind        text not null check (kind in ('view', 'pick', 'extra', 'review', 'message')),
  item        text not null default '' check (char_length(item) <= 80),
  created_at  timestamptz not null default now()
);
create index if not exists guide_events_prop_idx on public.guide_events (property_id, created_at desc);
alter table public.guide_events enable row level security;
drop policy if exists "hosts read own guide events" on public.guide_events;
create policy "hosts read own guide events" on public.guide_events for select
  using (exists (select 1 from public.properties p where p.id = property_id and p.owner_id = auth.uid()) or public.admin_ok());
revoke insert, update, delete on public.guide_events from anon, authenticated;

-- Guests' phones record taps through this function only. Capped at 600 events per property per hour.
create or replace function public.guide_track(p_property uuid, p_kind text, p_item text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_kind not in ('view', 'pick', 'extra', 'review', 'message') then return; end if;
  if not exists (select 1 from public.properties where id = p_property) then return; end if;
  if (select count(*) from public.guide_events where property_id = p_property and created_at > now() - interval '1 hour') >= 600 then return; end if;
  insert into public.guide_events (property_id, kind, item) values (p_property, p_kind, left(coalesce(p_item, ''), 80));
end $$;
revoke all on function public.guide_track(uuid, text, text) from public;
grant execute on function public.guide_track(uuid, text, text) to anon, authenticated;

-- Keep 180 days of guide events.
create or replace function public.karibu_retention() returns void
language sql security definer set search_path = public as $$
  delete from public.stays where checkout < current_date - 30;
  delete from public.pairing_codes where created_at < now() - interval '1 day';
  delete from public.devices where property_id is null and owner_id is null
    and coalesce(last_seen, created_at) < now() - interval '30 days';
  delete from public.guide_events where created_at < now() - interval '180 days';
$$;
revoke all on function public.karibu_retention() from public, anon, authenticated;

-- --------------------------------------------------------------- pricing
-- Mirror of apps/web/src/lib/pricing.ts. Payments must be checked against this, never the browser.
create or replace function public.price_quote(p_tvs int, p_month int, p_currency text default 'KES') returns jsonb
language plpgsql immutable set search_path = public as $$
declare
  n int := least(500, greatest(1, coalesce(p_tvs, 1)));
  m int := greatest(1, coalesce(p_month, 1));
  intro boolean := m <= 3;
  unit numeric := case when p_currency = 'USD' then (case when intro then 3.10 else 3.90 end)
                       else (case when intro then 399 else 499 end) end;
  places int := case when p_currency = 'USD' then 2 else 0 end;
  subtotal numeric := round(unit * n, places);
  discount numeric := case when n >= 5 then round(subtotal * 0.15, places) else 0 end;
begin
  if p_currency not in ('KES', 'USD') then raise exception 'Unsupported currency.' using errcode = '22023'; end if;
  return jsonb_build_object('currency', p_currency, 'tvs', n, 'month', m, 'unit', unit, 'intro', intro,
    'subtotal', subtotal, 'discount', discount, 'total', subtotal - discount, 'bulk', n >= 5);
end $$;
grant execute on function public.price_quote(int, int, text) to anon, authenticated;

-- Quote for the signed-in host's next month, using their real subscription month.
create or replace function public.my_price_quote(p_tvs int, p_currency text default 'KES') returns jsonb
language sql stable security definer set search_path = public as $$
  select public.price_quote(p_tvs,
    coalesce((select (extract(year from age(now(), sub_started_at)) * 12 + extract(month from age(now(), sub_started_at)))::int + 1
              from public.profiles where id = auth.uid() and sub_started_at is not null), 1),
    p_currency)
$$;
grant execute on function public.my_price_quote(int, text) to authenticated;

-- Payments can only be recorded by the server (service role) and must match the quote.
create or replace function public.payments_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare q jsonb;
begin
  if new.period = 'month' then
    q := public.price_quote(new.tvs, coalesce((select (extract(year from age(now(), sub_started_at)) * 12
           + extract(month from age(now(), sub_started_at)))::int + 1 from public.profiles where id = new.user_id and sub_started_at is not null), 1), new.currency);
    if new.amount <> (q ->> 'total')::numeric then
      raise exception 'Amount % does not match the price %.', new.amount, q ->> 'total' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists payments_guard on public.payments;
create trigger payments_guard before insert on public.payments for each row execute function public.payments_guard();

-- ------------------------------------------------- guest guide v2 (cleaning)
create or replace function public.guest_guide(p_property uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', name, 'area', area, 'theme', theme, 'color_bg', color_bg, 'color_accent', color_accent,
    'host_name', host_name, 'host_contact', host_contact, 'checkout_time', checkout_time,
    'picks', picks, 'extras', extras, 'review_url', review_url,
    'cleaning', case when show_cleaning then cleaning else '[]'::jsonb end)
  from public.properties where id = p_property
$$;
revoke all on function public.guest_guide(uuid) from public;
grant execute on function public.guest_guide(uuid) to anon, authenticated;

-- ------------------------------------------------------------ make an admin
-- Run once in the SQL Editor (replace the email), then sign in and turn on two-step verification:
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'connect@mrserengeti.com');

-- ------------------------------------------------------------ AI usage cap
-- Written only by the ai-insights Edge Function (service role); used for a per-host daily cap.
create table if not exists public.ai_usage (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  mode       text not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_user_idx on public.ai_usage (user_id, created_at desc);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;
