-- Karibu TV v5: operations for the separate super admin app.
-- Account status, team roles, host notes, sales pipeline, support tickets, packages and coupons,
-- manual payments, shop (products, delivery zones, orders), app settings, TV fleet view.
-- Run after 20261113000000_karibu_byok_oauth.sql. Safe to re-run.

-- ============================================================ accounts
alter table public.profiles
  add column if not exists active boolean not null default true,
  add column if not exists admin_role text;
alter table public.profiles drop constraint if exists profiles_admin_role_check;
alter table public.profiles add constraint profiles_admin_role_check
  check (admin_role is null or admin_role in ('owner', 'support', 'sales', 'ops'));
update public.profiles set admin_role = 'owner' where role = 'admin' and admin_role is null;

-- A deactivated host's TVs show "service paused" instead of guest details.
create or replace function public.tv_screen(p_device_key text, p_secret text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  d public.devices;
  p public.properties;
  info jsonb;
  rank int;
begin
  d := public.device_for(p_device_key, p_secret);
  if d.id is null or d.property_id is null then return jsonb_build_object('error', 'unpaired'); end if;
  select * into p from public.properties where id = d.property_id;
  if not coalesce((select active from public.profiles where id = p.owner_id), true) then
    return jsonb_build_object('error', 'paused', 'server_time', now());
  end if;
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

-- Deactivated hosts can't change their data (their sign-in is also blocked by the admin-api function).
create or replace function public.require_active() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.admin_ok()
     and not coalesce((select active from public.profiles where id = auth.uid()), true) then
    raise exception 'account_paused: This account is paused. Contact Karibu TV support.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists properties_active on public.properties;
create trigger properties_active before insert or update or delete on public.properties for each row execute function public.require_active();
drop trigger if exists stays_active on public.stays;
create trigger stays_active before insert or update or delete on public.stays for each row execute function public.require_active();

-- Admins can edit any profile through audited functions only.
create or replace function public.admin_update_host(p_user uuid, p_patch jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_ok() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.profiles set
    name = coalesce(p_patch ->> 'name', name),
    whatsapp = coalesce(p_patch ->> 'whatsapp', whatsapp),
    country = coalesce(p_patch ->> 'country', country),
    business_name = coalesce(p_patch ->> 'business_name', business_name),
    active = coalesce((p_patch ->> 'active')::boolean, active)
  where id = p_user;
  perform public.audit('update_host', p_user::text, p_patch);
end $$;
grant execute on function public.admin_update_host(uuid, jsonb) to authenticated;

-- ============================================================ host notes
create table if not exists public.host_notes (
  id         uuid primary key default gen_random_uuid(),
  host_id    uuid not null references auth.users (id) on delete cascade,
  author_id  uuid references auth.users (id) on delete set null default auth.uid(),
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.host_notes enable row level security;
drop policy if exists "admins manage notes" on public.host_notes;
create policy "admins manage notes" on public.host_notes for all using (public.admin_ok()) with check (public.admin_ok());

-- ============================================================ sales pipeline
alter table public.leads
  add column if not exists status text not null default 'new',
  add column if not exists notes text not null default '',
  add column if not exists follow_up_at timestamptz,
  add column if not exists owner_id uuid references auth.users (id) on delete set null,
  add column if not exists host_id uuid references auth.users (id) on delete set null,
  add column if not exists value_kes int not null default 0,
  add column if not exists updated_at timestamptz not null default now();
alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check check (status in ('new', 'contacted', 'demo', 'trial', 'won', 'lost'));
grant update (status, notes, follow_up_at, owner_id, host_id, value_kes, updated_at, name, email, whatsapp, city, tv_count) on public.leads to authenticated;
drop policy if exists "admins update leads" on public.leads;
create policy "admins update leads" on public.leads for update to authenticated using (public.admin_ok()) with check (public.admin_ok());
drop policy if exists "admins add leads" on public.leads;
create policy "admins add leads" on public.leads for insert to authenticated with check (public.admin_ok());
grant delete on public.leads to authenticated;
drop policy if exists "admins delete leads" on public.leads;
create policy "admins delete leads" on public.leads for delete to authenticated using (public.admin_ok());

-- ============================================================ support tickets
create sequence if not exists public.ticket_number_seq start 1001;
create table if not exists public.tickets (
  id              uuid primary key default gen_random_uuid(),
  number          int not null unique default nextval('public.ticket_number_seq'),
  user_id         uuid not null references auth.users (id) on delete cascade default auth.uid(),
  property_id     uuid references public.properties (id) on delete set null,
  device_id       uuid references public.devices (id) on delete set null,
  category        text not null default 'other' check (category in ('tv', 'setup', 'billing', 'account', 'shop', 'feature', 'other')),
  priority        text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  subject         text not null check (char_length(subject) between 3 and 120),
  status          text not null default 'open' check (status in ('open', 'pending', 'resolved', 'closed')),
  assignee_id     uuid references auth.users (id) on delete set null,
  rating          int check (rating between 1 and 5),
  first_reply_at  timestamptz,
  last_message_at timestamptz not null default now(),
  last_author     text not null default 'host' check (last_author in ('host', 'admin')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists tickets_user_idx on public.tickets (user_id, last_message_at desc);
create index if not exists tickets_status_idx on public.tickets (status, last_message_at desc);

create table if not exists public.ticket_messages (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.tickets (id) on delete cascade,
  author_id   uuid references auth.users (id) on delete set null default auth.uid(),
  author_role text not null default 'host' check (author_role in ('host', 'admin')),
  body        text not null check (char_length(body) between 1 and 5000),
  internal    boolean not null default false,
  attachment  text not null default '' check (char_length(attachment) <= 300),
  created_at  timestamptz not null default now()
);
create index if not exists ticket_messages_ticket_idx on public.ticket_messages (ticket_id, created_at);

alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;

drop policy if exists "hosts read own tickets" on public.tickets;
create policy "hosts read own tickets" on public.tickets for select using (user_id = auth.uid() or public.admin_ok());
drop policy if exists "hosts open tickets" on public.tickets;
create policy "hosts open tickets" on public.tickets for insert with check (user_id = auth.uid());
-- Hosts can only rate or close their own tickets; everything else goes through admins.
revoke update on public.tickets from anon, authenticated;
grant update (rating, status) on public.tickets to authenticated;
drop policy if exists "hosts rate or close own tickets" on public.tickets;
create policy "hosts rate or close own tickets" on public.tickets for update using (user_id = auth.uid()) with check (user_id = auth.uid() and status in ('resolved', 'closed', 'open'));
drop policy if exists "admins update tickets" on public.tickets;
create policy "admins update tickets" on public.tickets for update using (public.admin_ok()) with check (public.admin_ok());
grant update (status, priority, assignee_id, category) on public.tickets to authenticated;

drop policy if exists "read ticket messages" on public.ticket_messages;
create policy "read ticket messages" on public.ticket_messages for select using (
  public.admin_ok() or (not internal and exists (select 1 from public.tickets t where t.id = ticket_id and t.user_id = auth.uid())));
drop policy if exists "hosts reply" on public.ticket_messages;
create policy "hosts reply" on public.ticket_messages for insert with check (
  author_role = 'host' and not internal and author_id = auth.uid()
  and exists (select 1 from public.tickets t where t.id = ticket_id and t.user_id = auth.uid()));
drop policy if exists "admins reply" on public.ticket_messages;
create policy "admins reply" on public.ticket_messages for insert with check (public.admin_ok() and author_role = 'admin');

-- New message: bump the ticket, set status, and tell the host when the team replies.
create or replace function public.ticket_message_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare t public.tickets;
begin
  select * into t from public.tickets where id = new.ticket_id;
  if new.internal then return new; end if;
  update public.tickets set
    last_message_at = now(), updated_at = now(), last_author = new.author_role,
    first_reply_at = case when new.author_role = 'admin' and first_reply_at is null then now() else first_reply_at end,
    status = case when new.author_role = 'admin' then (case when status = 'open' then 'pending' else status end)
                  else 'open' end
  where id = new.ticket_id;
  if new.author_role = 'admin' then
    insert into public.host_notifications (user_id, title, body, link, tone)
    values (t.user_id, format('Reply on ticket #%s', t.number), left(new.body, 140), '/app/support/' || t.id, 'info');
  end if;
  return new;
end $$;
drop trigger if exists ticket_message_after on public.ticket_messages;
create trigger ticket_message_after after insert on public.ticket_messages for each row execute function public.ticket_message_after();

-- Hosts may only rate, resolve, close or reopen their own tickets; triage fields are admin-only.
create or replace function public.tickets_update_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_ok() and (new.priority is distinct from old.priority or new.assignee_id is distinct from old.assignee_id
     or new.category is distinct from old.category or new.user_id is distinct from old.user_id) then
    raise exception 'Only the support team can change that.' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists tickets_update_guard on public.tickets;
create trigger tickets_update_guard before update on public.tickets for each row execute function public.tickets_update_guard();

-- Rate limit: a host can open at most 10 tickets a day.
create or replace function public.tickets_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.tickets where user_id = new.user_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'rate_limited: You''ve opened a lot of tickets today. Reply on an existing one or WhatsApp us.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists tickets_guard on public.tickets;
create trigger tickets_guard before insert on public.tickets for each row execute function public.tickets_guard();

do $$ begin
  alter publication supabase_realtime add table public.tickets, public.ticket_messages;
exception when others then null; end $$;

-- Ticket screenshots: private bucket. Hosts write under <their id>/, admins read everything.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support-files', 'support-files', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists "support upload own" on storage.objects;
create policy "support upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'support-files' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "support read own or admin" on storage.objects;
create policy "support read own or admin" on storage.objects for select to authenticated
  using (bucket_id = 'support-files' and ((storage.foldername(name))[1] = auth.uid()::text or public.admin_ok()));

-- ============================================================ packages and coupons
create table if not exists public.packages (
  key                text primary key,
  name               text not null,
  intro_price_kes    int not null check (intro_price_kes >= 0),
  standard_price_kes int not null check (standard_price_kes >= 0),
  intro_price_usd    numeric(8, 2) not null check (intro_price_usd >= 0),
  standard_price_usd numeric(8, 2) not null check (standard_price_usd >= 0),
  intro_months       int not null default 3 check (intro_months between 0 and 24),
  bulk_min_tvs       int not null default 5 check (bulk_min_tvs >= 2),
  bulk_percent       int not null default 15 check (bulk_percent between 0 and 90),
  trial_days         int not null default 30 check (trial_days between 0 and 365),
  max_properties     int not null default 50,
  active             boolean not null default true,
  updated_at         timestamptz not null default now()
);
insert into public.packages (key, name, intro_price_kes, standard_price_kes, intro_price_usd, standard_price_usd)
values ('pro', 'Pro', 399, 499, 3.10, 3.90) on conflict (key) do nothing;
alter table public.packages enable row level security;
drop policy if exists "anyone reads packages" on public.packages;
create policy "anyone reads packages" on public.packages for select using (true);
drop policy if exists "admins edit packages" on public.packages;
create policy "admins edit packages" on public.packages for update using (public.admin_ok()) with check (public.admin_ok());
grant select on public.packages to anon, authenticated;
grant update on public.packages to authenticated;

create or replace function public.packages_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  perform public.audit('update_package', new.key, to_jsonb(new));
  return new;
end $$;
drop trigger if exists packages_audit on public.packages;
create trigger packages_audit before update on public.packages for each row execute function public.packages_audit();

-- Pricing now reads the Pro package (the app reads the same row through public.packages).
create or replace function public.price_quote(p_tvs int, p_month int, p_currency text default 'KES') returns jsonb
language plpgsql stable set search_path = public as $$
declare
  pk public.packages;
  n int := least(500, greatest(1, coalesce(p_tvs, 1)));
  m int := greatest(1, coalesce(p_month, 1));
  intro boolean;
  unit numeric;
  places int := case when p_currency = 'USD' then 2 else 0 end;
  subtotal numeric;
  discount numeric;
begin
  if p_currency not in ('KES', 'USD') then raise exception 'Unsupported currency.' using errcode = '22023'; end if;
  select * into pk from public.packages where key = 'pro';
  intro := m <= coalesce(pk.intro_months, 3);
  unit := case when p_currency = 'USD' then (case when intro then coalesce(pk.intro_price_usd, 3.10) else coalesce(pk.standard_price_usd, 3.90) end)
               else (case when intro then coalesce(pk.intro_price_kes, 399) else coalesce(pk.standard_price_kes, 499) end) end;
  subtotal := round(unit * n, places);
  discount := case when n >= coalesce(pk.bulk_min_tvs, 5) then round(subtotal * coalesce(pk.bulk_percent, 15) / 100.0, places) else 0 end;
  return jsonb_build_object('currency', p_currency, 'tvs', n, 'month', m, 'unit', unit, 'intro', intro,
    'subtotal', subtotal, 'discount', discount, 'total', subtotal - discount, 'bulk', discount > 0);
end $$;

create table if not exists public.coupons (
  code            text primary key check (code ~ '^[A-Z0-9_-]{3,24}$'),
  percent_off     int not null check (percent_off between 1 and 100),
  max_redemptions int check (max_redemptions > 0),
  redemptions     int not null default 0,
  expires_at      timestamptz,
  active          boolean not null default true,
  note            text not null default '' check (char_length(note) <= 200),
  created_at      timestamptz not null default now()
);
alter table public.coupons enable row level security;
drop policy if exists "admins manage coupons" on public.coupons;
create policy "admins manage coupons" on public.coupons for all using (public.admin_ok()) with check (public.admin_ok());

alter table public.payments
  add column if not exists coupon_code text references public.coupons (code) on delete set null,
  add column if not exists months int not null default 1 check (months between 1 and 24),
  add column if not exists recorded_by uuid references auth.users (id) on delete set null;

-- Payments must equal (monthly quote x months) minus any coupon. Server-side only.
create or replace function public.payments_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  first_month int;
  expected numeric := 0;
  pct int := 0;
  i int;
begin
  if new.period <> 'month' then return new; end if;
  first_month := coalesce((select (extract(year from age(now(), sub_started_at)) * 12 + extract(month from age(now(), sub_started_at)))::int + 1
                           from public.profiles where id = new.user_id and sub_started_at is not null), 1);
  for i in 0 .. coalesce(new.months, 1) - 1 loop
    expected := expected + (public.price_quote(new.tvs, first_month + i, new.currency) ->> 'total')::numeric;
  end loop;
  if new.coupon_code is not null then
    select percent_off into pct from public.coupons where code = new.coupon_code;
    expected := expected - round(expected * coalesce(pct, 0) / 100.0, case when new.currency = 'USD' then 2 else 0 end);
  end if;
  if new.amount <> expected then
    raise exception 'Amount % does not match the price %.', new.amount, expected using errcode = '22023';
  end if;
  return new;
end $$;

-- Record an M-Pesa (or card) payment by hand: the price is worked out here, never typed.
create or replace function public.admin_record_payment(p_user uuid, p_tvs int, p_months int, p_reference text, p_coupon text default null, p_provider text default 'mpesa')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c public.coupons;
  pay public.payments;
  first_month int;
  expected numeric := 0;
  i int;
begin
  if not public.admin_ok() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_coupon is not null and p_coupon <> '' then
    select * into c from public.coupons where code = upper(p_coupon) and active
      and (expires_at is null or expires_at > now()) and (max_redemptions is null or redemptions < max_redemptions);
    if c.code is null then raise exception 'That coupon isn''t valid.' using errcode = '22023'; end if;
  end if;
  first_month := coalesce((select (extract(year from age(now(), sub_started_at)) * 12 + extract(month from age(now(), sub_started_at)))::int + 1
                           from public.profiles where id = p_user and sub_started_at is not null), 1);
  for i in 0 .. greatest(1, p_months) - 1 loop
    expected := expected + (public.price_quote(p_tvs, first_month + i, 'KES') ->> 'total')::numeric;
  end loop;
  if c.code is not null then expected := expected - round(expected * c.percent_off / 100.0); end if;
  insert into public.payments (user_id, provider, amount, currency, period, tvs, months, status, provider_ref, coupon_code, recorded_by)
  values (p_user, p_provider, expected, 'KES', 'month', p_tvs, greatest(1, p_months), 'paid', left(coalesce(p_reference, ''), 40), c.code, auth.uid())
  returning * into pay;
  if c.code is not null then update public.coupons set redemptions = redemptions + 1 where code = c.code; end if;
  update public.profiles set plan = 'pro', trial = false, pro_tvs = p_tvs,
    sub_started_at = coalesce(sub_started_at, now()),
    plan_until = greatest(coalesce(plan_until, now()), now()) + make_interval(days => 30 * greatest(1, p_months))
  where id = p_user;
  perform public.audit('record_payment', p_user::text, jsonb_build_object('amount', expected, 'tvs', p_tvs, 'months', p_months, 'ref', p_reference, 'coupon', c.code));
  return to_jsonb(pay);
end $$;
grant execute on function public.admin_record_payment(uuid, int, int, text, text, text) to authenticated;

-- ============================================================ app settings
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  public     boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.app_settings (key, value, public) values
  ('shop', '{"mpesa_till": "", "mpesa_name": "Karibu TV", "whatsapp": "+254711855263", "pickup_note": ""}', true),
  ('support', '{"whatsapp": "+254711855263", "email": "connect@mrserengeti.com", "hours": "Mon-Sat, 8am-8pm EAT"}', true)
on conflict (key) do nothing;
alter table public.app_settings enable row level security;
drop policy if exists "public settings" on public.app_settings;
create policy "public settings" on public.app_settings for select using (public or public.admin_ok());
drop policy if exists "admins edit settings" on public.app_settings;
create policy "admins edit settings" on public.app_settings for all using (public.admin_ok()) with check (public.admin_ok());
grant select on public.app_settings to anon, authenticated;

-- ============================================================ shop
create table if not exists public.products (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name           text not null check (char_length(name) between 2 and 120),
  brand          text not null default '',
  tagline        text not null default '' check (char_length(tagline) <= 160),
  description    text not null default '' check (char_length(description) <= 4000),
  highlights     jsonb not null default '[]'::jsonb,
  specs          jsonb not null default '[]'::jsonb,
  in_box         jsonb not null default '[]'::jsonb,
  images         jsonb not null default '[]'::jsonb,
  price_kes      int not null check (price_kes >= 0),
  compare_at_kes int check (compare_at_kes >= 0),
  stock          int not null default 0 check (stock >= 0),
  badge          text not null default '' check (char_length(badge) <= 30),
  karibu_ready   boolean not null default true,
  active         boolean not null default true,
  sort           int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create table if not exists public.delivery_zones (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  areas           text not null default '',
  fee_kes         int not null check (fee_kes >= 0),
  eta             text not null default '',
  setup_available boolean not null default true,
  setup_fee_kes   int not null default 0 check (setup_fee_kes >= 0),
  active          boolean not null default true,
  sort            int not null default 0
);
create sequence if not exists public.order_number_seq start 10001;
create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  number         int not null unique default nextval('public.order_number_seq'),
  user_id        uuid references auth.users (id) on delete set null,
  name           text not null check (char_length(name) between 2 and 80),
  phone          text not null check (phone ~ '^\+\d{9,15}$'),
  email          text not null default '' check (char_length(email) <= 120),
  zone_id        uuid references public.delivery_zones (id) on delete set null,
  zone_name      text not null default '',
  address        text not null check (char_length(address) between 3 and 300),
  fulfilment     text not null check (fulfilment in ('delivery', 'delivery_setup')),
  payment_method text not null check (payment_method in ('mpesa_till', 'cod', 'whatsapp')),
  mpesa_code     text not null default '' check (char_length(mpesa_code) <= 20),
  items          jsonb not null,
  subtotal_kes   int not null,
  delivery_kes   int not null default 0,
  setup_kes      int not null default 0,
  total_kes      int not null,
  status         text not null default 'new' check (status in ('new', 'awaiting_payment', 'paid', 'packed', 'dispatched', 'delivered', 'cancelled')),
  note           text not null default '' check (char_length(note) <= 500),
  admin_note     text not null default '' check (char_length(admin_note) <= 1000),
  lookup_token   text not null default encode(extensions.gen_random_bytes(12), 'hex'),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists orders_status_idx on public.orders (status, created_at desc);

alter table public.products enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.orders enable row level security;
drop policy if exists "anyone reads active products" on public.products;
create policy "anyone reads active products" on public.products for select using (active or public.admin_ok());
drop policy if exists "admins manage products" on public.products;
create policy "admins manage products" on public.products for all using (public.admin_ok()) with check (public.admin_ok());
drop policy if exists "anyone reads zones" on public.delivery_zones;
create policy "anyone reads zones" on public.delivery_zones for select using (active or public.admin_ok());
drop policy if exists "admins manage zones" on public.delivery_zones;
create policy "admins manage zones" on public.delivery_zones for all using (public.admin_ok()) with check (public.admin_ok());
grant select on public.products, public.delivery_zones to anon, authenticated;
grant insert, update, delete on public.products, public.delivery_zones to authenticated;
drop policy if exists "own orders or admin" on public.orders;
create policy "own orders or admin" on public.orders for select using (user_id = auth.uid() or public.admin_ok());
drop policy if exists "admins update orders" on public.orders;
create policy "admins update orders" on public.orders for update using (public.admin_ok()) with check (public.admin_ok());
revoke insert, delete on public.orders from anon, authenticated;
grant update (status, admin_note, mpesa_code) on public.orders to authenticated;

-- Place an order. Prices, fees and stock are taken from the database, never from the browser.
create or replace function public.place_order(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  z public.delivery_zones;
  pr public.products;
  item jsonb;
  qty int;
  lines jsonb := '[]'::jsonb;
  subtotal int := 0;
  setup int := 0;
  units int := 0;
  o public.orders;
  v_phone text := regexp_replace(coalesce(p ->> 'phone', ''), '[^\d+]', '', 'g');
begin
  if jsonb_typeof(p -> 'items') <> 'array' or jsonb_array_length(p -> 'items') = 0 or jsonb_array_length(p -> 'items') > 10 then
    raise exception 'Your cart is empty.' using errcode = '22023';
  end if;
  if (select count(*) from public.orders o2 where o2.phone = v_phone and o2.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limited: Too many orders from this number. WhatsApp us and we''ll help.' using errcode = 'P0001';
  end if;
  select * into z from public.delivery_zones where id = (p ->> 'zone_id')::uuid and active;
  if z.id is null then raise exception 'Choose a delivery area.' using errcode = '22023'; end if;
  if p ->> 'fulfilment' = 'delivery_setup' and not z.setup_available then
    raise exception 'Setup visits aren''t available in %. Choose delivery only.', z.name using errcode = '22023';
  end if;
  for item in select * from jsonb_array_elements(p -> 'items') loop
    qty := greatest(1, least(10, coalesce((item ->> 'qty')::int, 1)));
    select * into pr from public.products where id = (item ->> 'product_id')::uuid and active for update;
    if pr.id is null then raise exception 'A product in your cart is no longer available.' using errcode = '22023'; end if;
    if pr.stock < qty then raise exception 'Only % of % left in stock.', pr.stock, pr.name using errcode = '22023'; end if;
    update public.products set stock = stock - qty, updated_at = now() where id = pr.id;
    subtotal := subtotal + pr.price_kes * qty;
    units := units + qty;
    lines := lines || jsonb_build_array(jsonb_build_object('product_id', pr.id, 'slug', pr.slug, 'name', pr.name, 'price_kes', pr.price_kes, 'qty', qty,
      'image', coalesce(pr.images ->> 0, '')));
  end loop;
  if p ->> 'fulfilment' = 'delivery_setup' then setup := z.setup_fee_kes; end if;
  insert into public.orders (user_id, name, phone, email, zone_id, zone_name, address, fulfilment, payment_method, mpesa_code, items,
    subtotal_kes, delivery_kes, setup_kes, total_kes, status, note)
  values (auth.uid(), trim(p ->> 'name'), v_phone, trim(coalesce(p ->> 'email', '')), z.id, z.name, trim(p ->> 'address'),
    p ->> 'fulfilment', p ->> 'payment_method', upper(trim(coalesce(p ->> 'mpesa_code', ''))), lines,
    subtotal, z.fee_kes, setup, subtotal + z.fee_kes + setup,
    case when p ->> 'payment_method' = 'mpesa_till' then 'awaiting_payment' else 'new' end,
    left(coalesce(p ->> 'note', ''), 500))
  returning * into o;
  return jsonb_build_object('number', o.number, 'token', o.lookup_token, 'total_kes', o.total_kes, 'status', o.status);
end $$;
revoke all on function public.place_order(jsonb) from public;
grant execute on function public.place_order(jsonb) to anon, authenticated;

-- Order confirmation page: needs the number and its secret token.
create or replace function public.order_lookup(p_number int, p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(o) - 'admin_note' - 'lookup_token' - 'user_id' from public.orders o where number = p_number and lookup_token = p_token
$$;
grant execute on function public.order_lookup(int, text) to anon, authenticated;

-- Cancelling an order puts its items back in stock. Audited.
create or replace function public.admin_order_status(p_order uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare o public.orders; item jsonb;
begin
  if not public.admin_ok() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into o from public.orders where id = p_order for update;
  if o.id is null then raise exception 'Order not found.'; end if;
  if p_status = 'cancelled' and o.status <> 'cancelled' then
    for item in select * from jsonb_array_elements(o.items) loop
      update public.products set stock = stock + (item ->> 'qty')::int where id = (item ->> 'product_id')::uuid;
    end loop;
  end if;
  update public.orders set status = p_status, admin_note = coalesce(p_note, admin_note), updated_at = now() where id = p_order;
  perform public.audit('order_status', o.number::text, jsonb_build_object('from', o.status, 'to', p_status));
end $$;
grant execute on function public.admin_order_status(uuid, text, text) to authenticated;

-- Seed products and zones (edit freely in the admin).
insert into public.products (slug, name, brand, tagline, description, highlights, specs, in_box, images, price_kes, stock, badge, sort) values
('google-tv-streamer', 'Google TV Streamer 4K (32 GB)', 'Google', 'The fastest way to run Karibu TV. Ethernet built in.',
 'Google''s newest streamer sits beside the TV instead of behind it, with a wired Ethernet port for rock-solid Wi-Fi-free connection. It is the smoothest box we have tested for welcome screens that stay on all day.',
 '["4K HDR with Dolby Vision", "32 GB storage, twice the memory of Chromecast", "Built-in Ethernet port", "Voice remote with find-my-remote"]',
 '[["Resolution", "4K HDR, Dolby Vision"], ["Audio", "Dolby Atmos"], ["Storage", "32 GB"], ["Network", "Wi-Fi and Ethernet"], ["Smart home", "Thread, Google Home and Matter hub"], ["Colour", "Porcelain"]]',
 '["Google TV Streamer", "Voice remote", "Power adapter"]',
 '["/shop/google-tv-streamer/1.jpg", "/shop/google-tv-streamer/2.jpg", "/shop/google-tv-streamer/3.jpg", "/shop/google-tv-streamer/4.jpg"]',
 16500, 10, 'Best for hosts', 1),
('chromecast-4k', 'Chromecast with Google TV 4K', 'Google', 'Plugs behind any TV. Sharp 4K, simple remote.',
 'A small stick that turns any TV with HDMI into a Google TV. Karibu TV installs in minutes and starts by itself when the TV turns on.',
 '["Up to 4K HDR", "Voice remote with TV volume and input buttons", "Hides behind the TV"]',
 '[["Resolution", "Up to 4K HDR"], ["Voice", "Google Assistant"], ["Remote", "Voice remote, controls TV volume and input"], ["Connection", "HDMI"]]',
 '["Chromecast with Google TV", "Voice remote", "Power cable and adapter", "2 AAA batteries"]',
 '["/shop/chromecast-4k/1.png", "/shop/chromecast-4k/2.jpg"]',
 9500, 10, 'Popular', 2),
('chromecast-hd', 'Chromecast with Google TV HD', 'Google', 'The budget pick for bedroom TVs.',
 'Full HD Google TV for smaller and secondary TVs, like the bedroom. Same simple setup and remote as the 4K model.',
 '["Full HD 1080p with HDR10, HDR10+ and Dolby Vision", "Dual-band Wi-Fi 5", "Voice remote"]',
 '[["Resolution", "1080p Full HD"], ["HDR", "HDR10, HDR10+, Dolby Vision"], ["Wi-Fi", "Dual-band Wi-Fi 5"], ["Model", "GA03131-GB"], ["Weight", "55 g"], ["Colour", "Snow"]]',
 '["Chromecast with Google TV (HD)", "Voice remote", "Power cable and adapter", "2 AAA batteries"]',
 '["/shop/chromecast-hd/1.jpg", "/shop/chromecast-hd/2.jpg", "/shop/chromecast-hd/3.jpg", "/shop/chromecast-hd/4.jpg"]',
 7500, 10, '', 3),
('fire-tv-stick-4k-max', 'Amazon Fire TV Stick 4K Max (2nd Gen)', 'Amazon', 'Wi-Fi 6E and 16 GB for busy homes.',
 'Amazon''s fastest stick, with Wi-Fi 6E and 16 GB of storage. Karibu TV installs through the Downloader app.',
 '["4K Ultra HD with Dolby Vision and HDR10+", "Wi-Fi 6E", "16 GB storage", "Alexa Voice Remote Enhanced"]',
 '[["Resolution", "4K Ultra HD, Dolby Vision, HDR10+"], ["Audio", "Dolby Atmos"], ["Wi-Fi", "Wi-Fi 6E"], ["Storage", "16 GB"]]',
 '["Fire TV Stick 4K Max", "Alexa Voice Remote Enhanced", "Power cable and adapter", "HDMI extender", "2 AAA batteries"]',
 '["/shop/fire-tv-stick-4k-max/1.png", "/shop/fire-tv-stick-4k-max/2.jpg", "/shop/fire-tv-stick-4k-max/3.jpg", "/shop/fire-tv-stick-4k-max/4.jpg"]',
 8999, 10, '', 4),
('fire-tv-stick-4k', 'Amazon Fire TV Stick 4K (2nd Gen)', 'Amazon', 'Great 4K picture at a lower price.',
 'A reliable 4K stick with Wi-Fi 6 and an Alexa remote that controls the TV''s power and volume.',
 '["4K Ultra HD with Dolby Vision and HDR10+", "Wi-Fi 6", "Alexa Voice Remote with TV controls"]',
 '[["Resolution", "4K Ultra HD, Dolby Vision, HDR10+"], ["Audio", "Dolby Atmos"], ["Wi-Fi", "Wi-Fi 6"]]',
 '["Fire TV Stick 4K", "Alexa Voice Remote", "Power cable and adapter", "HDMI extender", "2 AAA batteries"]',
 '["/shop/fire-tv-stick-4k/1.png", "/shop/fire-tv-stick-4k/2.jpg", "/shop/fire-tv-stick-4k/3.jpg", "/shop/fire-tv-stick-4k/4.jpg"]',
 7499, 10, '', 5)
on conflict (slug) do nothing;

insert into public.delivery_zones (name, areas, fee_kes, eta, setup_available, setup_fee_kes, sort) values
('Nairobi CBD and Westlands', 'CBD, Westlands, Parklands, Kilimani, Kileleshwa, Lavington', 300, 'Same day if ordered by 2pm', true, 1500, 1),
('Nairobi suburbs', 'Karen, Langata, South B/C, Embakasi, Kasarani, Runda, Gigiri, Muthaiga', 500, 'Same or next day', true, 1500, 2),
('Nairobi surroundings', 'Kiambu, Ruiru, Thika Road, Kitengela, Syokimau, Rongai, Ngong, Juja', 700, 'Next day', true, 2000, 3)
on conflict (name) do nothing;

-- ============================================================ admin views
create or replace function public.admin_devices() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.admin_ok() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'app_version', d.app_version, 'last_seen', d.last_seen, 'opened_at', d.opened_at,
      'property', p.name, 'area', p.area, 'host_id', d.owner_id, 'host', coalesce(nullif(pr.name, ''), u.email), 'screen', concat(d.screen_w, 'x', d.screen_h))
      order by d.last_seen desc nulls last)
    from public.devices d left join public.properties p on p.id = d.property_id
    left join public.profiles pr on pr.id = d.owner_id left join auth.users u on u.id = d.owner_id
    where d.property_id is not null), '[]'::jsonb);
end $$;
grant execute on function public.admin_devices() to authenticated;

-- Hosts list now includes active state and open tickets.
create or replace function public.admin_hosts() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.admin_ok() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'email', u.email, 'whatsapp', p.whatsapp, 'country', p.country, 'role', p.role, 'admin_role', p.admin_role,
      'business_name', p.business_name, 'plan', p.plan, 'plan_until', p.plan_until, 'pro_tvs', p.pro_tvs, 'trial', p.trial, 'active', p.active,
      'created_at', p.created_at, 'last_sign_in_at', u.last_sign_in_at, 'email_confirmed_at', u.email_confirmed_at,
      'properties', (select count(*) from public.properties x where x.owner_id = p.id),
      'tvs', (select count(*) from public.devices d where d.owner_id = p.id and d.property_id is not null),
      'tvs_online', (select count(*) from public.devices d where d.owner_id = p.id and d.last_seen > now() - interval '10 minutes'),
      'open_tickets', (select count(*) from public.tickets t where t.user_id = p.id and t.status in ('open', 'pending')),
      'paid_kes', (select coalesce(sum(amount), 0) from public.payments y where y.user_id = p.id and y.status = 'paid' and y.currency = 'KES'))
      order by p.created_at desc)
    from public.profiles p join auth.users u on u.id = p.id), '[]'::jsonb);
end $$;

-- Overview numbers for the admin home.
create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.admin_ok() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'hosts', (select count(*) from public.profiles where role = 'host'),
    'hosts_7d', (select count(*) from public.profiles where role = 'host' and created_at > now() - interval '7 days'),
    'pro', (select count(*) from public.profiles where plan = 'pro' and plan_until > now() and not trial),
    'trials', (select count(*) from public.profiles where trial and plan_until > now()),
    'trials_ending_7d', (select count(*) from public.profiles where trial and plan_until between now() and now() + interval '7 days'),
    'paused', (select count(*) from public.profiles where not active),
    'properties', (select count(*) from public.properties),
    'tvs', (select count(*) from public.devices where property_id is not null),
    'tvs_online', (select count(*) from public.devices where property_id is not null and last_seen > now() - interval '10 minutes'),
    'leads_open', (select count(*) from public.leads where status not in ('won', 'lost')),
    'leads_7d', (select count(*) from public.leads where created_at > now() - interval '7 days'),
    'tickets_open', (select count(*) from public.tickets where status = 'open'),
    'tickets_pending', (select count(*) from public.tickets where status = 'pending'),
    'orders_open', (select count(*) from public.orders where status in ('new', 'awaiting_payment', 'paid', 'packed', 'dispatched')),
    'orders_today', (select count(*) from public.orders where created_at > date_trunc('day', now())),
    'revenue_30d', (select coalesce(sum(amount), 0) from public.payments where status = 'paid' and currency = 'KES' and created_at > now() - interval '30 days'),
    'shop_30d', (select coalesce(sum(total_kes), 0) from public.orders where status in ('paid', 'packed', 'dispatched', 'delivered') and created_at > now() - interval '30 days'),
    'mrr', (select coalesce(sum((public.price_quote(pro_tvs, 4, 'KES') ->> 'total')::numeric), 0) from public.profiles where plan = 'pro' and plan_until > now() and not trial),
    'guide_scans_7d', (select count(*) from public.guide_events where kind = 'view' and created_at > now() - interval '7 days'),
    'signups_30d', (select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'n', (select count(*) from public.profiles where role = 'host' and created_at::date = d::date)) order by d), '[]'::jsonb)
                    from generate_series(current_date - 29, current_date, interval '1 day') d));
end $$;

-- Admins see everything about tickets; give them host emails too.
create or replace function public.admin_tickets() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.admin_ok() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(t) || jsonb_build_object('host', coalesce(nullif(p.name, ''), u.email), 'email', u.email, 'property', pr.name) order by
      case t.status when 'open' then 0 when 'pending' then 1 when 'resolved' then 2 else 3 end, t.last_message_at desc)
    from public.tickets t join auth.users u on u.id = t.user_id left join public.profiles p on p.id = t.user_id
    left join public.properties pr on pr.id = t.property_id), '[]'::jsonb);
end $$;
grant execute on function public.admin_tickets() to authenticated;
