// Calendar sync (BUILD_SPEC 8.4).
//   POST { calendar_id }  — "Sync now" from the dashboard (host JWT, Pro only)
//   POST { all: true }    — every 30 min from pg_cron (service-role key)
import { admin, caller, cors, isPro, json } from "../_shared/supabase.ts";
import { bookings, parseIcal } from "../_shared/ical.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";

interface Cal { id: string; property_id: string; url: string }

async function syncOne(db: SupabaseClient, cal: Cal) {
  let status: "ok" | "error" = "ok", lastError = "", count = 0;
  try {
    const res = await fetch(cal.url.replace(/^webcal:/i, "https:"), {
      headers: { "User-Agent": "KaribuTV/1.0 calendar-sync" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`The calendar link returned HTTP ${res.status}. Check the link is still valid.`);
    const events = bookings(parseIcal(await res.text()));
    count = events.length;
    const seen = new Set<string>();
    const today = new Date().toISOString().slice(0, 10);

    for (const ev of events) {
      seen.add(ev.uid);
      const { data: existing } = await db.from("stays").select("id, source")
        .eq("property_id", cal.property_id).eq("external_id", ev.uid).maybeSingle();
      if (existing) {
        // Never overwrite a name the host typed; manual stays keep their own dates.
        const patch: Record<string, unknown> = { cancelled: false };
        if (existing.source === "ical") Object.assign(patch, { checkin: ev.checkin, checkout: ev.checkout });
        await db.from("stays").update(patch).eq("id", existing.id);
        continue;
      }
      // A manual stay with exactly these dates replaces the calendar one.
      const { data: manual } = await db.from("stays").select("id")
        .eq("property_id", cal.property_id).eq("source", "manual").eq("external_id", "")
        .eq("checkin", ev.checkin).eq("checkout", ev.checkout).limit(1).maybeSingle();
      if (manual) {
        await db.from("stays").update({ external_id: ev.uid, calendar_id: cal.id }).eq("id", manual.id);
        continue;
      }
      await db.from("stays").insert({
        property_id: cal.property_id, first_name: "", checkin: ev.checkin, checkout: ev.checkout,
        source: "ical", calendar_id: cal.id, external_id: ev.uid, cancelled: false,
      });
    }

    // Future stays from this feed whose UID disappeared are cancelled.
    const { data: mine } = await db.from("stays").select("id, external_id")
      .eq("calendar_id", cal.id).eq("cancelled", false).gte("checkout", today);
    const gone = (mine || []).filter((s) => !seen.has(s.external_id)).map((s) => s.id);
    if (gone.length) await db.from("stays").update({ cancelled: true }).in("id", gone);
  } catch (e) {
    status = "error";
    lastError = (e instanceof Error ? e.message : String(e)).slice(0, 480);
    if (/timed? ?out|abort/i.test(lastError)) lastError = "The calendar link took too long to answer. Try again later.";
  }
  await db.from("calendars").update({ last_status: status, last_error: lastError, event_count: count, last_synced: new Date().toISOString() }).eq("id", cal.id);
  return { status, event_count: count, last_error: lastError };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = admin();
  const who = await caller(req);
  const body = await req.json().catch(() => ({}));

  if (body.all) {
    if (!who.isService) return json({ message: "Forbidden" }, 403);
    const { data: cals } = await db.from("calendars").select("id, property_id, url, properties!inner(owner_id)");
    const proCache = new Map<string, boolean>();
    let synced = 0;
    for (const c of cals || []) {
      const owner = (c as unknown as { properties: { owner_id: string } }).properties.owner_id;
      if (!proCache.has(owner)) proCache.set(owner, await isPro(db, owner));
      if (proCache.get(owner)) { await syncOne(db, c); synced++; }
    }
    return json({ synced });
  }

  if (!who.userId) return json({ message: "Sign in first." }, 401);
  const { data: cal } = await db.from("calendars").select("id, property_id, url, properties!inner(owner_id)").eq("id", body.calendar_id).maybeSingle();
  if (!cal || (cal as unknown as { properties: { owner_id: string } }).properties.owner_id !== who.userId) return json({ message: "Calendar not found." }, 404);
  if (!(await isPro(db, who.userId))) return json({ message: "Calendar sync is a Pro feature.", code: "pro_required" }, 403);
  return json(await syncOne(db, cal));
});
