// East African markets first. Dial codes fix the phone prefix; currency is for display hints.
import type { CountryCode } from "./types";

export interface Country { code: CountryCode; name: string; dial: string; flag: string; currency: string; digits: [number, number] }

export const COUNTRIES: Country[] = [
  { code: "KE", name: "Kenya", dial: "+254", flag: "KE", currency: "KES", digits: [9, 9] },
  { code: "TZ", name: "Tanzania", dial: "+255", flag: "TZ", currency: "TZS", digits: [9, 9] },
  { code: "UG", name: "Uganda", dial: "+256", flag: "UG", currency: "UGX", digits: [9, 9] },
  { code: "RW", name: "Rwanda", dial: "+250", flag: "RW", currency: "RWF", digits: [9, 9] },
  { code: "BI", name: "Burundi", dial: "+257", flag: "BI", currency: "BIF", digits: [8, 8] },
  { code: "SS", name: "South Sudan", dial: "+211", flag: "SS", currency: "SSP", digits: [9, 9] },
  { code: "ET", name: "Ethiopia", dial: "+251", flag: "ET", currency: "ETB", digits: [9, 9] },
  { code: "SO", name: "Somalia", dial: "+252", flag: "SO", currency: "SOS", digits: [7, 9] },
  { code: "CD", name: "DR Congo", dial: "+243", flag: "CD", currency: "CDF", digits: [9, 9] },
];

export const countryOf = (code?: string) => COUNTRIES.find((c) => c.code === code);

/** Split a stored "+2547…" number into country + local digits. */
export function splitPhone(value: string, fallback: CountryCode = "KE") {
  const v = (value || "").replace(/[^\d+]/g, "");
  const c = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length).find((x) => v.startsWith(x.dial));
  if (c) return { country: c.code, local: v.slice(c.dial.length) };
  return { country: fallback, local: v.replace(/^\+/, "").replace(/^0/, "") };
}

/** Local part (drop a leading 0) joined to the dial code: "0712 345 678" + KE -> "+254712345678". */
export function joinPhone(country: CountryCode, local: string) {
  const c = countryOf(country);
  const digits = (local || "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "";
  return c ? `${c.dial}${digits}` : `+${digits}`;
}

export function phoneValid(country: CountryCode, local: string) {
  const c = countryOf(country);
  const n = (local || "").replace(/\D/g, "").replace(/^0+/, "").length;
  return c ? n >= c.digits[0] && n <= c.digits[1] : n >= 7 && n <= 14;
}
