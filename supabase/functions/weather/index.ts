// Weather (BUILD_SPEC 8.6): geocode with Nominatim, forecast from MET Norway.
//   POST { property_id } — after the host saves a place (host JWT, Pro only)
//   POST { all: true }   — hourly from pg_cron (service-role key)
import { admin, caller, cors, isPro, json } from "../_shared/supabase.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";

const UA = Deno.env.get("MET_USER_AGENT") || "KaribuTV/1.0 (hello@karibu.tv)";
const OFFSETS: Record<string, number> = {
  "Africa/Nairobi": 180, "Africa/Dar_es_Salaam": 180, "Africa/Kampala": 180, "Africa/Addis_Ababa": 180,
  "Africa/Kigali": 120, "Africa/Lusaka": 120, "Africa/Johannesburg": 120, "Africa/Lagos": 60, "Africa/Accra": 0,
  "Indian/Mauritius": 240, "Indian/Mahe": 240,
};
const localDate = (ms: number, off: number) => new Date(ms + off * 60000).toISOString().slice(0, 10);
const symbol = (s?: string) => (s || "").replace(/_(day|night|polartwilight)$/, "");

interface Prop { id: string; owner_id: string; timezone: string; weather_place: string; weather_lat: number | null; weather_lon: number | null; area: string }

async function update(db: SupabaseClient, p: Prop) {
  let { weather_lat: lat, weather_lon: lon } = p;
  const place = p.weather_place || p.area;
  if ((lat == null || lon == null) && place) {
    const g = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(place)}`, { headers: { "User-Agent": UA } });
    const list = g.ok ? await g.json() : [];
    if (!list.length) return { ok: false, message: `We couldn't find "${place}". Try "Town, Country".` };
    lat = Math.round(parseFloat(list[0].lat) * 1e4) / 1e4;
    lon = Math.round(parseFloat(list[0].lon) * 1e4) / 1e4;
  }
  if (lat == null || lon == null) return { ok: false, message: "Add a place for the weather." };
  const res = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`, { headers: { "User-Agent": UA } });
  if (!res.ok) return { ok: false, message: "The weather service didn't answer. We'll retry within the hour." };
  const series = (await res.json())?.properties?.timeseries || [];
  if (!series.length) return { ok: false, message: "No forecast for that place." };
  const off = OFFSETS[p.timezone] ?? 180;
  const first = series[0];
  const today = { temp_c: Math.round(first.data.instant.details.air_temperature), symbol: symbol((first.data.next_1_hours || first.data.next_6_hours)?.summary?.symbol_code) };
  const byDay = new Map<string, { date: string; min_c: number; max_c: number; symbol: string }>();
  for (const s of series) {
    const t = Date.parse(s.time), day = localDate(t, off), temp = s.data.instant.details.air_temperature;
    const d = byDay.get(day) || { date: day, min_c: temp, max_c: temp, symbol: "" };
    d.min_c = Math.min(d.min_c, temp); d.max_c = Math.max(d.max_c, temp);
    const hour = new Date(t + off * 60000).getUTCHours();
    const six = s.data.next_6_hours || s.data.next_1_hours;
    if (six?.summary && (!d.symbol || (hour >= 9 && hour <= 15))) d.symbol = symbol(six.summary.symbol_code);
    byDay.set(day, d);
  }
  const todayStr = localDate(Date.now(), off);
  const days = [...byDay.values()].filter((d) => d.date > todayStr).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3)
    .map((d) => ({ ...d, min_c: Math.round(d.min_c), max_c: Math.round(d.max_c) }));
  await db.from("properties").update({ weather_lat: lat, weather_lon: lon, weather_json: { today, days }, weather_at: new Date().toISOString() }).eq("id", p.id);
  return { ok: true, today, days };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const db = admin();
  const who = await caller(req);
  const body = await req.json().catch(() => ({}));
  const cols = "id, owner_id, timezone, weather_place, weather_lat, weather_lon, area";

  if (body.all) {
    if (!who.isService) return json({ message: "Forbidden" }, 403);
    const { data } = await db.from("properties").select(cols).eq("weather_enabled", true);
    let n = 0;
    for (const p of data || []) { if (await isPro(db, p.owner_id)) { await update(db, p); n++; await new Promise((r) => setTimeout(r, 1100)); } }
    return json({ updated: n });
  }

  if (!who.userId) return json({ message: "Sign in first." }, 401);
  const { data: p } = await db.from("properties").select(cols).eq("id", body.property_id).maybeSingle();
  if (!p || p.owner_id !== who.userId) return json({ message: "Property not found." }, 404);
  if (!(await isPro(db, who.userId))) return json({ message: "Weather on the TV is a Pro feature.", code: "pro_required" }, 403);
  return json(await update(db, p));
});
