-- Run once in the Supabase SQL Editor AFTER the Edge Functions are deployed.
-- Replace <PROJECT_REF> and <SERVICE_ROLE_KEY> (Project Settings → API). Keep the key out of git.
create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.schedule('karibu-ical-sync', '*/30 * * * *', $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/ical-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <SERVICE_ROLE_KEY>'),
    body := '{"all": true}'::jsonb)
$$);

select cron.schedule('karibu-weather', '7 * * * *', $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/weather',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <SERVICE_ROLE_KEY>'),
    body := '{"all": true}'::jsonb)
$$);
