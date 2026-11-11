// Date helpers. Stays are date-only (YYYY-MM-DD) and are read in the property's timezone,
// using the same fixed offsets as the server (East/Central Africa have no DST).
const TZ_OFFSETS: Record<string, number> = {
  "Africa/Nairobi": 180, "Africa/Dar_es_Salaam": 180, "Africa/Kampala": 180, "Africa/Addis_Ababa": 180,
  "Africa/Mogadishu": 180, "Africa/Kigali": 120, "Africa/Bujumbura": 120, "Africa/Lusaka": 120,
  "Africa/Harare": 120, "Africa/Maputo": 120, "Africa/Johannesburg": 120, "Africa/Lagos": 60,
  "Africa/Kinshasa": 60, "Africa/Accra": 0, "UTC": 0, "Indian/Mauritius": 240, "Indian/Mahe": 240, "Asia/Dubai": 240,
};

export const TIMEZONES = [
  { value: "Africa/Nairobi", label: "Nairobi, Mombasa (EAT, UTC+3)" },
  { value: "Africa/Dar_es_Salaam", label: "Dar es Salaam, Zanzibar (EAT, UTC+3)" },
  { value: "Africa/Kampala", label: "Kampala (EAT, UTC+3)" },
  { value: "Africa/Addis_Ababa", label: "Addis Ababa (EAT, UTC+3)" },
  { value: "Africa/Kigali", label: "Kigali (CAT, UTC+2)" },
  { value: "Africa/Lusaka", label: "Lusaka (CAT, UTC+2)" },
  { value: "Africa/Johannesburg", label: "Johannesburg, Cape Town (SAST, UTC+2)" },
  { value: "Africa/Lagos", label: "Lagos (WAT, UTC+1)" },
  { value: "Africa/Accra", label: "Accra (GMT)" },
  { value: "Indian/Mauritius", label: "Mauritius (UTC+4)" },
  { value: "Indian/Mahe", label: "Seychelles (UTC+4)" },
];

export const tzOffset = (tz?: string) => TZ_OFFSETS[tz || ""] ?? 180;

const pad = (n: number) => String(n).padStart(2, "0");
export const dateOnly = (v: string | null | undefined) => String(v || "").slice(0, 10);

export function todayIn(tz?: string, nowMs = Date.now()) {
  const d = new Date(nowMs + tzOffset(tz) * 60000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
export function minutesNowIn(tz?: string, nowMs = Date.now()) {
  const d = new Date(nowMs + tzOffset(tz) * 60000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}
export function addDays(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1, d) + n * 86400000);
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
}
export function nightsBetween(a: string, b: string) {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}
export const toDbDate = (date: string) => `${date} 00:00:00.000Z`;

const DAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_EN_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS_SW_LONG = ["Jumapili", "Jumatatu", "Jumanne", "Jumatano", "Alhamisi", "Ijumaa", "Jumamosi"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_SW = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ago", "Sep", "Okt", "Nov", "Des"];

function parts(date: string) {
  const [y, m, d] = dateOnly(date).split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1, d));
  return { y, m: m - 1, d, dow: x.getUTCDay() };
}
/** "Wed 12 Nov" */
export function fmtDay(date: string, lang: "en" | "sw" = "en") {
  if (!date) return "";
  const p = parts(date);
  return lang === "sw" ? `${p.d} ${MONTHS_SW[p.m]}` : `${DAYS_EN[p.dow]} ${p.d} ${MONTHS_EN[p.m]}`;
}
/** "12 Nov" */
export function fmtShort(date: string) {
  if (!date) return "";
  const p = parts(date);
  return `${p.d} ${MONTHS_EN[p.m]}`;
}
/** "Wednesday" */
export function fmtWeekday(date: string, lang: "en" | "sw" = "en") {
  const p = parts(date);
  return (lang === "sw" ? DAYS_SW_LONG : DAYS_EN_LONG)[p.dow];
}
export function fmtRange(a: string, b: string) {
  const pa = parts(a), pb = parts(b);
  if (pa.m === pb.m && pa.y === pb.y) return `${pa.d}–${pb.d} ${MONTHS_EN[pb.m]}`;
  return `${pa.d} ${MONTHS_EN[pa.m]} – ${pb.d} ${MONTHS_EN[pb.m]}`;
}

/** "just now", "12 min ago", "3 h ago", "2 days ago" */
export function timeAgo(v: string) {
  if (!v) return "never";
  const t = Date.parse(v.replace(" ", "T"));
  if (isNaN(t)) return "never";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

export type TvStatus = "online" | "idle" | "offline" | "never";
export function tvStatus(lastSeen: string): TvStatus {
  if (!lastSeen) return "never";
  const t = Date.parse(lastSeen.replace(" ", "T"));
  const mins = (Date.now() - t) / 60000;
  if (mins < 10) return "online";
  if (mins > 30) return "offline";
  return "idle";
}

export function fmtDateLong(v: string) {
  if (!v) return "";
  const p = parts(v);
  return `${p.d} ${MONTHS_EN[p.m]} ${p.y}`;
}
