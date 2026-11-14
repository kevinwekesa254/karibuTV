-- Simple pricing: Pro is KES 499 (US$3.90) per TV a month. Paying for 12 months gets 2 months free.
-- No intro price and no multi-TV discount. public.plan_price() is the one rule every payment is checked against
-- (it mirrors apps/web/src/lib/pricing.ts). Payments already recorded keep what they were charged.

alter table public.packages add column if not exists yearly_free_months int not null default 2 check (yearly_free_months between 0 and 6);
update public.packages set intro_months = 0, bulk_percent = 0 where key = 'pro' and (intro_months <> 0 or bulk_percent <> 0);

-- One month for n TVs (same shape as before so existing callers keep working).
create or replace function public.price_quote(p_tvs int, p_month int, p_currency text default 'KES') returns jsonb
language plpgsql stable set search_path = public as $$
declare
  pk public.packages;
  n int := least(500, greatest(1, coalesce(p_tvs, 1)));
  places int := case when p_currency = 'USD' then 2 else 0 end;
  unit numeric;
  total numeric;
begin
  if p_currency not in ('KES', 'USD') then raise exception 'Unsupported currency.' using errcode = '22023'; end if;
  select * into pk from public.packages where key = 'pro';
  unit := case when p_currency = 'USD' then coalesce(pk.standard_price_usd, 3.90) else coalesce(pk.standard_price_kes, 499) end;
  total := round(unit * n, places);
  return jsonb_build_object('currency', p_currency, 'tvs', n, 'month', greatest(1, coalesce(p_month, 1)), 'unit', unit, 'intro', false,
    'subtotal', total, 'discount', 0, 'total', total, 'bulk', false);
end $$;

-- Price for n TVs over m months: every full 12 months, 2 months are free.
create or replace function public.plan_price(p_tvs int, p_months int, p_currency text default 'KES') returns numeric
language sql stable set search_path = public as $$
  with m as (select greatest(1, least(24, coalesce(p_months, 1))) as months)
  select (public.price_quote(p_tvs, 1, p_currency) ->> 'total')::numeric
         * (m.months - (m.months / 12) * coalesce((select yearly_free_months from public.packages where key = 'pro'), 2))
  from m
$$;
grant execute on function public.plan_price(int, int, text) to anon, authenticated;

-- Payments must equal plan_price minus any coupon. Server-side only.
create or replace function public.payments_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  expected numeric;
  pct int := 0;
begin
  if new.period <> 'month' then return new; end if;
  expected := public.plan_price(new.tvs, coalesce(new.months, 1), new.currency);
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
  expected numeric;
begin
  if not public.admin_ok() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_coupon is not null and p_coupon <> '' then
    select * into c from public.coupons where code = upper(p_coupon) and active
      and (expires_at is null or expires_at > now()) and (max_redemptions is null or redemptions < max_redemptions);
    if c.code is null then raise exception 'That coupon isn''t valid.' using errcode = '22023'; end if;
  end if;
  expected := public.plan_price(p_tvs, greatest(1, p_months), 'KES');
  if c.code is not null then expected := expected - round(expected * c.percent_off / 100.0); end if;
  insert into public.payments (user_id, provider, amount, currency, period, tvs, months, status, provider_ref, coupon_code, recorded_by)
  values (p_user, p_provider, expected, 'KES', 'month', p_tvs, greatest(1, p_months), 'paid', left(coalesce(p_reference, ''), 40), c.code, auth.uid())
  returning * into pay;
  if c.code is not null then update public.coupons set redemptions = redemptions + 1 where code = c.code; end if;
  update public.profiles set plan = 'pro', trial = false, pro_tvs = p_tvs,
    sub_started_at = coalesce(sub_started_at, now()),
    plan_until = greatest(coalesce(plan_until, now()), now()) + make_interval(months => greatest(1, p_months))
  where id = p_user;
  perform public.audit('record_payment', p_user::text, jsonb_build_object('amount', expected, 'tvs', p_tvs, 'months', p_months, 'ref', p_reference, 'coupon', c.code));
  return to_jsonb(pay);
end $$;
grant execute on function public.admin_record_payment(uuid, int, int, text, text, text) to authenticated;

-- Paystack checkout: monthly or yearly only.
create or replace function public.paystack_plan_create(p_user uuid, p_tvs int, p_months int) returns public.payments
language plpgsql security definer set search_path = public as $$
declare pay public.payments;
begin
  if p_months not in (1, 12) then raise exception 'Choose monthly or yearly.' using errcode = '22023'; end if;
  if p_tvs is null or p_tvs < 1 or p_tvs > 500 then raise exception 'Choose between 1 and 500 TVs.' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = p_user and coalesce(active, true)) then
    raise exception 'This account is paused. WhatsApp us and we''ll help.' using errcode = '42501';
  end if;
  update public.payments set status = 'cancelled'
    where user_id = p_user and provider = 'paystack' and status = 'pending' and created_at < now() - interval '1 day';
  insert into public.payments (user_id, provider, amount, currency, period, tvs, months, status, reference)
  values (p_user, 'paystack', public.plan_price(p_tvs, p_months, 'KES'), 'KES', 'month', p_tvs, p_months, 'pending',
          'KTVP' || upper(encode(extensions.gen_random_bytes(8), 'hex')))
  returning * into pay;
  return pay;
end $$;
revoke all on function public.paystack_plan_create(uuid, int, int) from public, anon, authenticated;
grant execute on function public.paystack_plan_create(uuid, int, int) to service_role;

-- Paid time is added in calendar months (a year is a full year).
-- Paystack confirmed a charge (webhook or the return page). Safe to call more than once.
create or replace function public.paystack_settle(p_ref text, p_amount_minor bigint, p_currency text, p_raw jsonb, p_order uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pay public.payments;
  o public.orders;
begin
  select * into pay from public.payments where reference = p_ref for update;
  if pay.id is not null then
    if pay.status = 'paid' then return jsonb_build_object('ok', true, 'kind', 'plan', 'already', true); end if;
    if p_currency <> pay.currency or p_amount_minor <> round(pay.amount * 100) then
      update public.payments set raw = p_raw where id = pay.id;
      return jsonb_build_object('ok', false, 'kind', 'plan', 'reason', 'Amount does not match');
    end if;
    update public.payments set status = 'paid', paid_at = now(), raw = p_raw,
      provider_ref = left(coalesce(p_raw ->> 'id', ''), 40),
      receipt = left(coalesce(p_raw -> 'authorization' ->> 'channel', p_raw ->> 'channel', ''), 40)
    where id = pay.id;
    update public.profiles set plan = 'pro', trial = false, pro_tvs = pay.tvs,
      sub_started_at = coalesce(sub_started_at, now()),
      plan_until = greatest(coalesce(plan_until, now()), now()) + make_interval(months => greatest(1, pay.months))
    where id = pay.user_id;
    insert into public.audit_log (actor, action, target, detail)
    values (null, 'paystack_payment', pay.user_id::text, jsonb_build_object('amount', pay.amount, 'tvs', pay.tvs, 'months', pay.months, 'ref', p_ref));
    return jsonb_build_object('ok', true, 'kind', 'plan', 'user_id', pay.user_id);
  end if;

  select * into o from public.orders where pay_reference = p_ref or (p_order is not null and id = p_order) for update;
  if o.id is null then return jsonb_build_object('ok', false, 'reason', 'Unknown reference'); end if;
  if o.status not in ('new', 'awaiting_payment') then
    if o.status = 'cancelled' and coalesce(o.paid_kes, 0) = 0 then
      update public.orders set paid_kes = (p_amount_minor / 100)::int,
        admin_note = left(trim(admin_note || E'\nPaid on Paystack (' || p_ref || ') after it was cancelled: refund it in Paystack.'), 1000), updated_at = now()
      where id = o.id;
    end if;
    return jsonb_build_object('ok', true, 'kind', 'order', 'already', true, 'number', o.number);
  end if;
  if p_currency <> 'KES' or p_amount_minor <> o.total_kes::bigint * 100 then
    update public.orders set admin_note = left(trim(admin_note || E'\nPaystack amount did not match (' || p_ref || ', ' || p_amount_minor / 100 || ' ' || p_currency || '). Check Paystack.'), 1000)
    where id = o.id;
    return jsonb_build_object('ok', false, 'kind', 'order', 'reason', 'Amount does not match');
  end if;
  update public.orders set status = 'paid', paid_kes = o.total_kes, pay_reference = p_ref, payment_method = 'paystack', updated_at = now() where id = o.id;
  return jsonb_build_object('ok', true, 'kind', 'order', 'number', o.number);
end $$;

revoke all on function public.paystack_settle(text, bigint, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.paystack_settle(text, bigint, text, jsonb, uuid) to service_role;
