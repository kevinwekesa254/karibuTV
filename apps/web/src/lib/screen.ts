// Screen-state logic (BUILD_SPEC 8.1) and ScreenPayload builder.
// Shared by the TV (/tv), the dashboard previews and the unit tests. Pure: no I/O.
import type { Property, ScreenPayload, ScreenState } from "./types.ts";
import { addDays, nightsBetween, tzOffset } from "./dates.ts";

const MIN = 60_000;
const pad = (n: number) => String(n).padStart(2, "0");

function localDate(ms: number, off: number) {
  const d = new Date(ms + off * MIN);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function localMinutes(ms: number, off: number) {
  const d = new Date(ms + off * MIN);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}
function localToUtc(date: string, minutes: number, off: number) {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) + minutes * MIN - off * MIN;
}
export function parseHHMM(s: string | undefined, fallback: number) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "").trim());
  if (!m || +m[1] > 23 || +m[2] > 59) return fallback;
  return +m[1] * 60 + +m[2];
}

export interface StayLike { first_name: string; checkin: string; checkout: string; cancelled?: boolean }

/**
 * - departing: checkout == today and now < checkout_time + 2 h
 * - current:   checkin <= today < checkout (arrival day counts from midnight)
 * - back-to-back: before checkout_time → checkout; from checkout_time → arriving (next guest)
 * - next_change_at: earliest of next midnight, checkout_time, checkout_time + 2 h
 */
export function computeState(o: { stays: StayLike[]; timezone?: string; checkoutTime?: string; nowMs: number }) {
  const off = tzOffset(o.timezone);
  const today = localDate(o.nowMs, off);
  const nowMin = localMinutes(o.nowMs, off);
  const coMin = parseHHMM(o.checkoutTime, 11 * 60);
  const stays = o.stays
    .filter((s) => !s.cancelled)
    .map((s) => ({ first_name: s.first_name || "", checkin: String(s.checkin).slice(0, 10), checkout: String(s.checkout).slice(0, 10) }))
    .filter((s) => s.checkin && s.checkout && s.checkin < s.checkout);

  let departing: (typeof stays)[number] | null = null;
  let current: (typeof stays)[number] | null = null;
  for (const s of stays) {
    if (s.checkout === today && nowMin < coMin + 120 && (!departing || s.checkin > departing.checkin)) departing = s;
    if (s.checkin <= today && today < s.checkout && (!current || s.checkin > current.checkin)) current = s;
  }

  let state: ScreenState = "between";
  let stay: (typeof stays)[number] | null = null;
  if (departing && current) {
    if (nowMin < coMin) { state = "checkout"; stay = departing; } else { state = "arriving"; stay = current; }
  } else if (departing) { state = "checkout"; stay = departing; }
  else if (current) { state = "arriving"; stay = current; }

  const next = Math.min(...[
    localToUtc(addDays(today, 1), 0, off),
    localToUtc(today, coMin, off),
    localToUtc(today, coMin + 120, off),
  ].filter((t) => t > o.nowMs));

  return { state, stay, next_change_at: next, today };
}

const esc = (s: string) => String(s || "").replace(/([\\;,:"])/g, "\\$1");
export function wifiQrString(security: string, ssid: string, password: string) {
  const t = security === "nopass" ? "nopass" : security || "WPA";
  return `WIFI:T:${t};S:${esc(ssid)};P:${t === "nopass" ? "" : esc(password)};;`;
}

export interface PlanFlags { pro: boolean }

export const SAMPLE_GUEST = "Priya";

/** Build what the TV shows. `forceState` (previews) fills in a sample guest when there's no real one. */
export function buildPayload(o: {
  property: Partial<Property> & { name: string };
  stays: StayLike[];
  plan: PlanFlags;
  nowMs: number;
  mediaUrl: (path: string) => string;
  forceState?: ScreenState;
  sampleName?: string;
  restricted?: boolean;
}): ScreenPayload {
  const p = o.property;
  const r = computeState({ stays: o.stays, timezone: p.timezone, checkoutTime: p.checkout_time, nowMs: o.nowMs });
  let state = r.state;
  let stay: StayLike | null = r.stay;

  if (o.forceState && o.forceState !== state) {
    state = o.forceState;
    stay = state === "between" ? null
      : state === "checkout" ? { first_name: o.sampleName ?? SAMPLE_GUEST, checkin: addDays(r.today, -3), checkout: r.today }
      : { first_name: o.sampleName ?? SAMPLE_GUEST, checkin: r.today, checkout: addDays(r.today, 3) };
  } else if (o.sampleName !== undefined && stay) {
    stay = { ...stay, first_name: o.sampleName };
  }
  if (o.restricted) { state = "between"; stay = null; }

  const photo = (state === "arriving" ? p.photo_welcome : state === "checkout" ? p.photo_checkout : p.photo_generic)
    || p.photo_generic || p.photo_welcome || "";
  const pro = o.plan.pro;
  const security = p.wifi_security || "WPA";
  const w = p.weather_json;

  return {
    state,
    now: new Date(o.nowMs).toISOString(),
    next_change_at: new Date(r.next_change_at).toISOString(),
    plan: { pro, branded: !pro, logo: pro, weather: pro },
    restricted: !!o.restricted,
    property: {
      name: p.name, tagline: p.tagline || "", area: p.area || "", timezone: p.timezone || "Africa/Nairobi",
      checkin_time: p.checkin_time || "14:00", checkout_time: p.checkout_time || "11:00",
      quiet_start: p.quiet_start || "", quiet_end: p.quiet_end || "",
      max_guests: p.max_guests || null,
      amenities: (p.amenities || []).slice(0, 9),
      house_rules: (p.house_rules || []).slice(0, 6),
      checkout_steps: (p.checkout_steps || []).slice(0, 6),
      host_name: p.host_name || "", host_contact: p.host_contact || "",
      welcome_title: p.welcome_title || "", welcome_note: p.welcome_note || "",
      generic_title: p.generic_title || "", generic_note: p.generic_note || "",
      thankyou_line: p.thankyou_line || "", contact_title: p.contact_title || "", contact_line: p.contact_line || "",
      layout: p.layout || "classic",
      theme: p.theme || "karibu",
      color_bg: p.theme === "custom" ? p.color_bg : undefined,
      color_accent: p.theme === "custom" ? p.color_accent : undefined,
      photo_url: photo ? o.mediaUrl(photo) : null,
      logo_url: pro && p.logo ? o.mediaUrl(p.logo) : null,
      logo_position: p.logo_position || "header",
    },
    wifi: {
      ssid: p.wifi_ssid || "",
      password: p.show_wifi_password === false ? null : p.wifi_password || "",
      security,
      qr_string: p.wifi_ssid ? wifiQrString(security, p.wifi_ssid, p.wifi_password || "") : "",
    },
    stay: stay ? { first_name: stay.first_name, checkin: stay.checkin, checkout: stay.checkout, nights: nightsBetween(stay.checkin, stay.checkout) } : null,
    weather: pro && p.weather_enabled && w?.today ? { place: p.weather_place || p.area || "", today: w.today, days: (w.days || []).slice(0, 3) } : null,
  };
}
