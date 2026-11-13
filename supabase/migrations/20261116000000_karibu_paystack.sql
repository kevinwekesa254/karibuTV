-- Paystack: hosts pay for Pro ahead (1, 3, 6 or 12 months) by M-Pesa or card; shop buyers pay at checkout.
-- The edge function supabase/functions/paystack talks to Paystack. Prices are worked out here, and a payment
-- only counts when Paystack's confirmed amount matches the amount we asked for.

alter table public.payments drop constraint if exists payments_provider_check;
alter table public.payments add constraint payments_provider_check check (provider in ('mpesa', 'card', 'paystack'));
alter table public.payments add column if not exists reference text;
alter table public.payments add column if not exists paid_at timestamptz;
create unique index if not exists payments_reference_key on public.payments (reference);

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check check (payment_method in ('mpesa_till', 'cod', 'whatsapp', 'paystack'));
alter table public.orders add column if not exists pay_reference text;
alter table public.orders add column if not exists paid_kes int;
create unique index if not exists orders_pay_reference_key on public.orders (pay_reference);

-- Shop orders paid online wait for Paystack, and need an email for the receipt.
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
  if p ->> 'payment_method' = 'paystack' and coalesce(p ->> 'email', '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Add your email to pay online. Paystack sends your receipt there.' using errcode = '22023';
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
    case when p ->> 'payment_method' in ('mpesa_till', 'paystack') then 'awaiting_payment' else 'new' end,
    left(coalesce(p ->> 'note', ''), 500))
  returning * into o;
  return jsonb_build_object('number', o.number, 'token', o.lookup_token, 'total_kes', o.total_kes, 'status', o.status);
end $$;
revoke all on function public.place_order(jsonb) from public;
grant execute on function public.place_order(jsonb) to anon, authenticated;

-- Start a Pro payment: a pending row with the server's price. Old unpaid attempts are closed.
create or replace function public.paystack_plan_create(p_user uuid, p_tvs int, p_months int) returns public.payments
language plpgsql security definer set search_path = public as $$
declare
  first_month int;
  expected numeric := 0;
  i int;
  pay public.payments;
begin
  if p_months not in (1, 3, 6, 12) then raise exception 'Choose 1, 3, 6 or 12 months.' using errcode = '22023'; end if;
  if p_tvs is null or p_tvs < 1 or p_tvs > 500 then raise exception 'Choose between 1 and 500 TVs.' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = p_user and coalesce(active, true)) then
    raise exception 'This account is paused. WhatsApp us and we''ll help.' using errcode = '42501';
  end if;
  update public.payments set status = 'cancelled'
    where user_id = p_user and provider = 'paystack' and status = 'pending' and created_at < now() - interval '1 day';
  first_month := coalesce((select (extract(year from age(now(), sub_started_at)) * 12 + extract(month from age(now(), sub_started_at)))::int + 1
                           from public.profiles where id = p_user and sub_started_at is not null), 1);
  for i in 0 .. p_months - 1 loop
    expected := expected + (public.price_quote(p_tvs, first_month + i, 'KES') ->> 'total')::numeric;
  end loop;
  insert into public.payments (user_id, provider, amount, currency, period, tvs, months, status, reference)
  values (p_user, 'paystack', expected, 'KES', 'month', p_tvs, p_months, 'pending', 'KTVP' || upper(encode(extensions.gen_random_bytes(8), 'hex')))
  returning * into pay;
  return pay;
end $$;

-- Start a shop payment: a fresh reference for this attempt (Paystack refuses a reused one).
create or replace function public.paystack_order_start(p_number int, p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where number = p_number and lookup_token = p_token for update;
  if o.id is null then raise exception 'We couldn''t find that order.' using errcode = '22023'; end if;
  if o.status not in ('new', 'awaiting_payment') then raise exception 'This order is already paid or closed.' using errcode = '22023'; end if;
  if o.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Add your email to pay online.' using errcode = '22023'; end if;
  update public.orders set pay_reference = 'KTVO' || upper(encode(extensions.gen_random_bytes(8), 'hex')), payment_method = 'paystack',
    status = 'awaiting_payment', updated_at = now()
  where id = o.id returning * into o;
  return jsonb_build_object('id', o.id, 'number', o.number, 'reference', o.pay_reference, 'amount_kes', o.total_kes, 'email', o.email, 'name', o.name);
end $$;

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
      plan_until = greatest(coalesce(plan_until, now()), now()) + make_interval(days => 30 * greatest(1, pay.months))
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

revoke all on function public.paystack_plan_create(uuid, int, int) from public, anon, authenticated;
revoke all on function public.paystack_order_start(int, text) from public, anon, authenticated;
revoke all on function public.paystack_settle(text, bigint, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.paystack_plan_create(uuid, int, int) to service_role;
grant execute on function public.paystack_order_start(int, text) to service_role;
grant execute on function public.paystack_settle(text, bigint, text, jsonb, uuid) to service_role;
