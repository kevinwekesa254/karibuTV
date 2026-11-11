-- Karibu TV v2: themed templates, review prompt, host picks and extras.
-- Additive only: safe to run on a database that already has 20261110000000_karibu_init.sql.

-- New TV themes (Coast, Safari Lodge, City).
alter table public.properties drop constraint if exists properties_theme_check;
alter table public.properties add constraint properties_theme_check check (theme in (
  'karibu', 'maroon', 'midnight', 'teal', 'forest', 'charcoal', 'plum', 'espresso', 'ocean', 'coast', 'safari', 'city', 'custom'));

alter table public.properties
  -- Check-out day: "Loved your stay?" QR to the listing's review page.
  add column if not exists review_url text not null default ''
    check (review_url = '' or (review_url ~* '^https?://' and char_length(review_url) <= 500)),
  -- Host picks: [{ "title": "Ali Barbour's Cave", "note": "Dinner in a cave, 10 min", "url": "https://…" }]
  add column if not exists picks jsonb not null default '[]'::jsonb
    check (jsonb_typeof(picks) = 'array' and jsonb_array_length(picks) <= 6),
  -- Extras guests can request on WhatsApp: [{ "title": "Airport transfer", "price": "KES 3,500" }]
  add column if not exists extras jsonb not null default '[]'::jsonb
    check (jsonb_typeof(extras) = 'array' and jsonb_array_length(extras) <= 6),
  -- Gentle motion on the TV (slow photo drift, name fade-in, evening warmth).
  add column if not exists motion boolean not null default true;

-- Guest phone page (/g/<property id>): the host's picks, extras and review link.
-- Read-only and limited to what the TV already shows; the property id is an unguessable uuid.
create or replace function public.guest_guide(p_property uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', name, 'area', area, 'theme', theme, 'color_bg', color_bg, 'color_accent', color_accent,
    'host_name', host_name, 'host_contact', host_contact, 'checkout_time', checkout_time,
    'picks', picks, 'extras', extras, 'review_url', review_url)
  from public.properties where id = p_property
$$;
revoke all on function public.guest_guide(uuid) from public;
grant execute on function public.guest_guide(uuid) to anon, authenticated;
