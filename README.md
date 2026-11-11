# Karibu TV

Turns the TV in a holiday rental into a personal welcome screen. A host pairs an Android TV / Google TV with a 6-character code; the TV greets each guest by name, shows a Wi-Fi QR code, house rules and check-out steps, and switches screens by itself from the host's bookings. English only for now.

Built from `BUILD_SPEC.md` v1.0. **Payments (spec §13) are not wired yet.**

## Layout

```
apps/web/        React 18 + TS + Vite + Tailwind: landing (/), host dashboard (/app/*), TV screen (/tv)
supabase/        migrations (schema, RLS, pairing + TV functions, storage), Edge Functions (ical-sync, weather), cron.sql
tv-android/      Kotlin Android TV shell: WebView on /tv, start on boot, screensaver, watchdog (not yet compiled)
design/          tokens.css, components.css, tailwind.preset.js
docs/            SETUP_GUIDE.md (TV install guide for hosts)
```

## How it fits together

- **Hosts** sign in with Supabase Auth (email + password). Row-level security limits every table to the host's own data. New hosts get a **30-day Pro trial** (3 TVs).
- **TVs never sign in.** A TV holds a random `device_key`; pairing (`pair_start` → host `pair_link` → `pair_status`) hands it a secret once. It reads its screen with `tv_screen(key, secret)` and reports with `tv_heartbeat`. Unlinking clears the secret, so access stops at once.
- **Screen state** (arriving / check-out day / between guests, spec §8.1) is computed on the TV and in the dashboard previews by `apps/web/src/lib/screen.ts`, the same code for both.
- **Live updates:** database triggers broadcast a `refresh` on each TV's Realtime channel; TVs also poll every 20 s as a fallback.
- **Plan limits** (TVs, properties, Pro-only logo, weather and calendars) are enforced in the database, not only in the UI.

## Set up Supabase

1. The Supabase GitHub integration (linked to this repo, directory `supabase`) applies `supabase/migrations` when `main` changes. To apply by hand instead, run the migration SQL once in the SQL Editor.
2. Deploy the Edge Functions `ical-sync` and `weather` (GitHub integration, or `supabase functions deploy`). Optional secret: `MET_USER_AGENT="KaribuTV/1.0 (you@domain)"`.
3. Run `supabase/cron.sql` once in the SQL Editor (fill in the project ref and service-role key) to sync calendars every 30 min and weather hourly.
4. Auth → URL configuration: set the Site URL to your domain and add `https://<domain>/reset/new` as a redirect URL.
5. Web app env (`apps/web/.env`, and in Vercel):
   ```
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon public key>
   VITE_APP_SHORT_URL=karibu.tv/app     # optional: what hosts type into the TV's Downloader app
   VITE_APK_URL=https://…/karibu-tv-1.0.0.apk   # optional
   ```

## Run locally

```bash
cd apps/web && npm install && npm run dev      # http://localhost:5173 (dashboard), /tv (TV screen)
npm test                                        # screen-state + iCal tests
```

The Android TV debug build loads `http://10.0.2.2:5173/tv` on the emulator.

## Making a host Pro (until payments ship)

Supabase → Table Editor → `profiles` → set `plan = pro`, `plan_until` (future date), `pro_tvs`, and `trial = false`. Hosts can't change these columns themselves.

## Hosting the web app

`apps/web/vercel.json` builds the Vite app and rewrites client routes to `index.html`. Set the Vercel project's root directory to `apps/web`.

## Known limitations

- Timezones use a fixed-offset table (East/Central/West Africa, Indian Ocean; none use DST) — see `apps/web/src/lib/dates.ts`.
- Deleting an account removes all of the host's data; the login itself is removed by an admin (Supabase → Authentication).
- The Android app hasn't been compiled or tested on a device yet.
- Brand name, domain and support WhatsApp number are placeholders in `apps/web/src/lib/brand.ts`.
