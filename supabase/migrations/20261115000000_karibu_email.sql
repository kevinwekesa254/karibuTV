-- Karibu TV v6: automatic emails through Brevo.
-- Everything is queued in public.email_outbox by triggers and a daily job; the send-emails function
-- delivers the queue every minute. Hosts choose whether they get reminders and newsletters.
-- Safe to run more than once.

-- ============================================================ preferences
alter table public.profiles
  add column if not exists email_reminders boolean not null default true,
  add column if not exists email_marketing boolean not null default false,
  add column if not exists email_token text not null default encode(extensions.gen_random_bytes(16), 'hex');
grant update (email_reminders, email_marketing) on public.profiles to authenticated;

-- ============================================================ queue
create table if not exists public.email_outbox (
  id          uuid primary key default gen_random_uuid(),
  template    text not null,
  to_email    text not null,
  to_name     text not null default '',
  user_id     uuid references auth.users (id) on delete set null,
  data        jsonb not null default '{}'::jsonb,
  kind        text not null default 'account' check (kind in ('account', 'reminder', 'marketing', 'team')),
  status      text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed', 'skipped')),
  attempts    int not null default 0,
  error       text not null default '',
  provider_id text not null default '',
  dedupe_key  text unique,
  send_after  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
create index if not exists email_outbox_due_idx on public.email_outbox (status, send_after);
create index if not exists email_outbox_created_idx on public.email_outbox (created_at desc);
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;
grant select on public.email_outbox to authenticated;
drop policy if exists "admins read emails" on public.email_outbox;
create policy "admins read emails" on public.email_outbox for select using (public.admin_ok());

-- Private settings for the sender (function address and the secret the cron job sends). No client access.
create table if not exists public.email_private (
  id           int primary key default 1 check (id = 1),
  function_url text not null default '',
  cron_secret  text not null default encode(extensions.gen_random_bytes(24), 'hex')
);
alter table public.email_private enable row level security;
revoke all on public.email_private from anon, authenticated;
insert into public.email_private (id, function_url)
values (1, 'https://pkgvidowjctwpzrpztuv.supabase.co/functions/v1/send-emails')
on conflict (id) do nothing;

-- Where team alerts go (Settings > Support contacts > email), falling back to connect@.
create or replace function public.team_email() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif((select value ->> 'email' from public.app_settings where key = 'support'), ''), 'connect@mrserengeti.com')
$$;

-- Queue one email. Reminders respect the host's choice; test accounts (@example.com) are never sent.
create or replace function public.queue_email(
  p_template text, p_to text, p_name text default '', p_user uuid default null, p_data jsonb default '{}'::jsonb,
  p_kind text default 'account', p_dedupe text default null, p_delay interval default interval '0'
) returns void
language plpgsql security definer set search_path = public as $$
declare v_status text := 'queued'; v_error text := '';
begin
  if coalesce(trim(p_to), '') = '' or position('@' in p_to) = 0 then return; end if;
  if lower(p_to) like '%@example.com' then v_status := 'skipped'; v_error := 'Test address'; end if;
  if p_user is not null and p_kind = 'reminder'
     and not coalesce((select email_reminders from public.profiles where id = p_user), true) then
    v_status := 'skipped'; v_error := 'Host turned off reminders';
  end if;
  if p_user is not null and p_kind = 'marketing'
     and not coalesce((select email_marketing from public.profiles where id = p_user), false) then
    v_status := 'skipped'; v_error := 'Host has not opted in';
  end if;
  insert into public.email_outbox (template, to_email, to_name, user_id, data, kind, status, error, dedupe_key, send_after)
  values (p_template, lower(trim(p_to)), left(coalesce(p_name, ''), 80), p_user, coalesce(p_data, '{}'::jsonb), p_kind, v_status, v_error, p_dedupe, now() + p_delay)
  on conflict (dedupe_key) do nothing;
end $$;
revoke execute on function public.queue_email(text, text, text, uuid, jsonb, text, text, interval) from public, anon, authenticated;

-- ============================================================ triggers
-- Welcome once the email address is confirmed (sign-up link or accepted invite). Also records newsletter consent.
create or replace function public.email_on_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  if tg_op = 'INSERT' and coalesce(new.raw_user_meta_data ->> 'marketing', '') = 'true' then
    update public.profiles set email_marketing = true where id = new.id;
  end if;
  if new.email_confirmed_at is not null and (tg_op = 'INSERT' or old.email_confirmed_at is null) then
    select * into p from public.profiles where id = new.id;
    if p.id is not null and p.role <> 'admin' then
      perform public.queue_email('welcome', new.email, p.name, new.id, '{}'::jsonb, 'account', 'welcome:' || new.id, interval '1 minute');
    end if;
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_email on auth.users;
create trigger on_auth_user_email after insert or update of email_confirmed_at on auth.users
  for each row execute function public.email_on_auth_user();

-- Newsletter opt-in or opt-out is synced to the Brevo list by the sender.
create or replace function public.email_on_marketing_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email_marketing is distinct from old.email_marketing then
    perform public.queue_email('_contact_sync', (select email from auth.users where id = new.id), new.name, new.id,
      jsonb_build_object('subscribe', new.email_marketing), 'account');
  end if;
  return new;
end $$;
drop trigger if exists profiles_marketing_email on public.profiles;
create trigger profiles_marketing_email after update of email_marketing on public.profiles
  for each row execute function public.email_on_marketing_change();

-- Support: the team hears about new tickets and host replies; hosts hear about team replies.
create or replace function public.email_on_ticket_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare t public.tickets; u record; first boolean;
begin
  if new.internal then return new; end if;
  select * into t from public.tickets where id = new.ticket_id;
  select au.email, p.name into u from auth.users au left join public.profiles p on p.id = au.id where au.id = t.user_id;
  if new.author_role = 'admin' then
    perform public.queue_email('ticket_reply', u.email, u.name, t.user_id,
      jsonb_build_object('ticket_id', t.id, 'number', t.number, 'subject', t.subject, 'body', left(new.body, 1500)), 'account');
  else
    first := (select count(*) from public.ticket_messages where ticket_id = t.id) = 1;
    perform public.queue_email(case when first then 'team_new_ticket' else 'team_ticket_reply' end, public.team_email(), 'Karibu TV team', null,
      jsonb_build_object('ticket_id', t.id, 'number', t.number, 'subject', t.subject, 'body', left(new.body, 1500),
        'category', t.category, 'priority', t.priority, 'host_name', u.name, 'host_email', u.email), 'team');
  end if;
  return new;
end $$;
drop trigger if exists ticket_message_email on public.ticket_messages;
create trigger ticket_message_email after insert on public.ticket_messages
  for each row execute function public.email_on_ticket_message();

create or replace function public.email_on_ticket_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare u record;
begin
  if new.status = 'resolved' and old.status is distinct from 'resolved' and public.admin_ok() then
    select au.email, p.name into u from auth.users au left join public.profiles p on p.id = au.id where au.id = new.user_id;
    perform public.queue_email('ticket_solved', u.email, u.name, new.user_id,
      jsonb_build_object('ticket_id', new.id, 'number', new.number, 'subject', new.subject), 'account',
      'solved:' || new.id || ':' || to_char(now(), 'YYYYMMDDHH24MI'), interval '2 minutes');
  end if;
  return new;
end $$;
drop trigger if exists tickets_email on public.tickets;
create trigger tickets_email after update of status on public.tickets
  for each row execute function public.email_on_ticket_update();

-- Shop orders: the buyer gets a confirmation and delivery updates; the team gets every new order.
create or replace function public.email_order_data(o public.orders) returns jsonb
language sql stable as $$
  select jsonb_build_object('order_id', o.id, 'number', o.number, 'token', o.lookup_token, 'items', o.items,
    'subtotal_kes', o.subtotal_kes, 'delivery_kes', o.delivery_kes, 'setup_kes', o.setup_kes, 'total_kes', o.total_kes,
    'payment_method', o.payment_method, 'zone_name', o.zone_name, 'address', o.address, 'fulfilment', o.fulfilment,
    'phone', o.phone, 'name', o.name, 'note', o.note, 'status', o.status)
$$;

create or replace function public.email_on_order() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.email <> '' then
      perform public.queue_email('order_confirmed', new.email, new.name, new.user_id, public.email_order_data(new), 'account', 'order:' || new.id);
    end if;
    perform public.queue_email('team_new_order', public.team_email(), 'Karibu TV team', null, public.email_order_data(new), 'team');
  elsif new.status is distinct from old.status and new.email <> ''
        and new.status in ('paid', 'dispatched', 'delivered', 'cancelled') then
    perform public.queue_email('order_' || new.status, new.email, new.name, new.user_id, public.email_order_data(new), 'account',
      'order:' || new.id || ':' || new.status);
  end if;
  return new;
end $$;
drop trigger if exists orders_email on public.orders;
create trigger orders_email after insert or update of status on public.orders
  for each row execute function public.email_on_order();

-- Payments: a receipt for every confirmed payment (sent a minute later so the new paid-until date is in).
create or replace function public.email_on_payment() returns trigger
language plpgsql security definer set search_path = public as $$
declare u record;
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    select au.email, p.name into u from auth.users au left join public.profiles p on p.id = au.id where au.id = new.user_id;
    perform public.queue_email('payment_receipt', u.email, u.name, new.user_id,
      jsonb_build_object('payment_id', new.id, 'amount', new.amount, 'currency', new.currency, 'tvs', new.tvs, 'months', coalesce(new.months, 1),
        'reference', new.provider_ref, 'provider', new.provider, 'coupon', new.coupon_code, 'paid_at', new.created_at),
      'account', 'receipt:' || new.id, interval '1 minute');
  end if;
  return new;
end $$;
drop trigger if exists payments_email on public.payments;
create trigger payments_email after insert or update of status on public.payments
  for each row execute function public.email_on_payment();

-- Leads from the website reach the team straight away.
create or replace function public.email_on_lead() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.source <> 'karibu-test' then
    perform public.queue_email('team_new_lead', public.team_email(), 'Karibu TV team', null,
      jsonb_build_object('lead_id', new.id, 'name', new.name, 'email', new.email, 'whatsapp', new.whatsapp, 'city', new.city,
        'country', new.country, 'tv_brand', new.tv_brand, 'tv_count', new.tv_count, 'message', new.message), 'team');
  end if;
  return new;
end $$;
drop trigger if exists leads_email on public.leads;
create trigger leads_email after insert on public.leads for each row execute function public.email_on_lead();

-- ============================================================ daily reminders (08:00 Nairobi)
create or replace function public.email_daily() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in
    select p.*, au.email from public.profiles p join auth.users au on au.id = p.id
    where p.role <> 'admin' and coalesce(p.active, true) and p.plan = 'pro' and p.plan_until is not null
  loop
    if r.trial and r.plan_until > now() + interval '2 days' and r.plan_until <= now() + interval '3 days' then
      perform public.queue_email('trial_ending', r.email, r.name, r.id, jsonb_build_object('plan_until', r.plan_until, 'tvs', r.pro_tvs), 'reminder',
        'trial3:' || r.id || ':' || r.plan_until::date); n := n + 1;
    elsif r.trial and r.plan_until <= now() and r.plan_until > now() - interval '1 day' then
      perform public.queue_email('trial_ended', r.email, r.name, r.id, jsonb_build_object('plan_until', r.plan_until), 'reminder',
        'trialend:' || r.id || ':' || r.plan_until::date); n := n + 1;
    elsif not r.trial and r.plan_until > now() + interval '6 days' and r.plan_until <= now() + interval '7 days' then
      perform public.queue_email('renew_reminder', r.email, r.name, r.id, jsonb_build_object('plan_until', r.plan_until, 'days', 7, 'tvs', r.pro_tvs), 'reminder',
        'renew7:' || r.id || ':' || r.plan_until::date); n := n + 1;
    elsif not r.trial and r.plan_until > now() and r.plan_until <= now() + interval '1 day' then
      perform public.queue_email('renew_reminder', r.email, r.name, r.id, jsonb_build_object('plan_until', r.plan_until, 'days', 1, 'tvs', r.pro_tvs), 'reminder',
        'renew1:' || r.id || ':' || r.plan_until::date); n := n + 1;
    elsif not r.trial and r.plan_until <= now() and r.plan_until > now() - interval '1 day' then
      perform public.queue_email('plan_expired', r.email, r.name, r.id, jsonb_build_object('plan_until', r.plan_until), 'reminder',
        'expired:' || r.id || ':' || r.plan_until::date); n := n + 1;
    end if;
  end loop;

  -- TVs that stopped checking in 24 to 48 hours ago (once per outage).
  for r in
    select d.id, d.name, d.last_seen, d.owner_id, pr.name as property, au.email, p.name as host
    from public.devices d
    join public.profiles p on p.id = d.owner_id
    join auth.users au on au.id = d.owner_id
    left join public.properties pr on pr.id = d.property_id
    where d.last_seen <= now() - interval '24 hours' and d.last_seen > now() - interval '48 hours'
      and coalesce(p.active, true) and p.role <> 'admin'
  loop
    perform public.queue_email('tv_offline', r.email, r.host, r.owner_id,
      jsonb_build_object('device', r.name, 'property', coalesce(r.property, ''), 'last_seen', r.last_seen), 'reminder',
      'offline:' || r.id || ':' || to_char(r.last_seen, 'YYYYMMDDHH24')); n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.email_daily() from public, anon, authenticated;

-- Wake the sender when something is due. Called every minute by pg_cron.
create or replace function public.email_kick() returns void
language plpgsql security definer set search_path = public as $$
declare s public.email_private;
begin
  if not exists (select 1 from public.email_outbox where status = 'queued' and send_after <= now())
     and not exists (select 1 from public.email_outbox where status = 'sending' and send_after < now() - interval '10 minutes') then
    return;
  end if;
  select * into s from public.email_private where id = 1;
  if coalesce(s.function_url, '') = '' then return; end if;
  perform net.http_post(url := s.function_url, body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', s.cron_secret),
    timeout_milliseconds := 55000);
end $$;
revoke execute on function public.email_kick() from public, anon, authenticated;

-- The sender claims a batch (oldest first, account and team mail before reminders). Stuck sends are retried.
create or replace function public.email_claim(p_limit int default 40) returns setof public.email_outbox
language plpgsql security definer set search_path = public as $$
begin
  update public.email_outbox set status = 'queued' where status = 'sending' and send_after < now() - interval '10 minutes';
  return query
  update public.email_outbox e set status = 'sending', attempts = e.attempts + 1, send_after = now()
  where e.id in (
    select id from public.email_outbox
    where status = 'queued' and send_after <= now()
    order by case kind when 'account' then 0 when 'team' then 1 when 'reminder' then 2 else 3 end, created_at
    limit greatest(1, least(p_limit, 100))
    for update skip locked)
  returning e.*;
end $$;
revoke execute on function public.email_claim(int) from public, anon, authenticated;
grant execute on function public.email_claim(int) to service_role;

-- ============================================================ unsubscribe (link in every reminder and newsletter)
create or replace function public.email_unsubscribe(p_token text, p_kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_kind not in ('reminders', 'marketing') or length(coalesce(p_token, '')) < 16 then return jsonb_build_object('ok', false); end if;
  if p_kind = 'reminders' then
    update public.profiles set email_reminders = false where email_token = p_token returning id into v_id;
  else
    update public.profiles set email_marketing = false where email_token = p_token returning id into v_id;
  end if;
  return jsonb_build_object('ok', v_id is not null);
end $$;
grant execute on function public.email_unsubscribe(text, text) to anon, authenticated;

-- ============================================================ admin tools
create or replace function public.admin_email_retry(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_ok() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  update public.email_outbox set status = 'queued', error = '', send_after = now(), attempts = 0
  where id = p_id and status in ('failed', 'skipped') and lower(to_email) not like '%@example.com';
  insert into public.audit_log (actor, action, target, detail) values (auth.uid(), 'email_retry', p_id::text, '{}'::jsonb);
end $$;
grant execute on function public.admin_email_retry(uuid) to authenticated;

create or replace function public.admin_email_test(p_to text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_ok() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  perform public.queue_email('test', p_to, '', null, jsonb_build_object('by', auth.uid()), 'team');
end $$;
grant execute on function public.admin_email_test(text) to authenticated;

create or replace function public.admin_email_stats() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.admin_ok() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'sent_today', (select count(*) from public.email_outbox where status = 'sent' and template not like '\_%' and sent_at >= date_trunc('day', now())),
    'queued', (select count(*) from public.email_outbox where status in ('queued', 'sending')),
    'failed_7d', (select count(*) from public.email_outbox where status = 'failed' and created_at > now() - interval '7 days'),
    'sent_30d', (select count(*) from public.email_outbox where status = 'sent' and template not like '\_%' and sent_at > now() - interval '30 days'),
    'newsletter', (select count(*) from public.profiles where email_marketing and role <> 'admin'),
    'reminders_off', (select count(*) from public.profiles where not email_reminders and role <> 'admin'));
end $$;
grant execute on function public.admin_email_stats() to authenticated;

-- ============================================================ schedule
do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;
  perform cron.schedule('karibu-email-send', '* * * * *', 'select public.email_kick()');
  perform cron.schedule('karibu-email-daily', '0 5 * * *', 'select public.email_daily()');
exception when others then
  raise notice 'pg_cron or pg_net not available (%). Enable them under Database > Extensions, then run this file again.', sqlerrm;
end $$;
