-- Karibu TV v4: hosts bring their own AI key (Claude or OpenAI), and Google / Apple sign-in.
-- Run after 20261112000000_karibu_admin.sql. Safe to re-run.

-- ------------------------------------------------------- host AI keys
-- The key is encrypted (AES-GCM) by the ai-keys Edge Function with the AI_KEYS_SECRET secret
-- before it reaches the database. Only the service role can read this table; hosts see
-- provider, model and the last 4 characters through my_ai_key().
create table if not exists public.ai_keys (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  provider    text not null check (provider in ('anthropic', 'openai')),
  model       text not null check (char_length(model) between 1 and 80),
  key_cipher  text not null,
  key_hint    text not null default '' check (char_length(key_hint) <= 8),
  verified_at timestamptz,
  updated_at  timestamptz not null default now()
);
alter table public.ai_keys enable row level security;
revoke all on public.ai_keys from anon, authenticated;

create or replace function public.my_ai_key() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('provider', provider, 'model', model, 'hint', key_hint, 'verified_at', verified_at)
  from public.ai_keys where user_id = auth.uid()
$$;
revoke all on function public.my_ai_key() from public, anon;
grant execute on function public.my_ai_key() to authenticated;

-- ------------------------------------------- Google / Apple sign-in names
-- OAuth providers send full_name / name / given_name instead of our sign-up "name" field,
-- and Google sends a photo URL.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, name, whatsapp, country, avatar, plan, plan_until, pro_tvs, trial)
  values (
    new.id,
    left(coalesce(nullif(m ->> 'name', ''), nullif(m ->> 'full_name', ''), nullif(m ->> 'given_name', ''), ''), 80),
    left(coalesce(m ->> 'whatsapp', ''), 20),
    case when m ->> 'country' in ('KE', 'TZ', 'UG', 'RW', 'BI', 'SS', 'ET', 'SO', 'CD', 'other') then m ->> 'country' else 'KE' end,
    case when coalesce(m ->> 'avatar_url', m ->> 'picture', '') ~ '^https://' then left(coalesce(m ->> 'avatar_url', m ->> 'picture'), 300) else '' end,
    'pro', now() + interval '30 days', 3, true
  )
  on conflict (id) do nothing;
  return new;
end $$;
