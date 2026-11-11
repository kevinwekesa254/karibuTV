import type { Cleaning } from "./types";

export const DAYS: { key: Cleaning["day"]; short: string; long: string }[] = [
  { key: "daily", short: "Daily", long: "Every day" },
  { key: "mon", short: "Mon", long: "Monday" }, { key: "tue", short: "Tue", long: "Tuesday" },
  { key: "wed", short: "Wed", long: "Wednesday" }, { key: "thu", short: "Thu", long: "Thursday" },
  { key: "fri", short: "Fri", long: "Friday" }, { key: "sat", short: "Sat", long: "Saturday" }, { key: "sun", short: "Sun", long: "Sunday" },
];

/** "Tue & Fri at 10:00" style summary; groups visits that share a time. */
export function cleaningSummary(list: Cleaning[]) {
  if (!list.length) return "";
  const byTime = new Map<string, string[]>();
  for (const c of list) {
    const d = DAYS.find((x) => x.key === c.day);
    if (!d) continue;
    byTime.set(c.time, [...(byTime.get(c.time) || []), d.key === "daily" ? "Daily" : d.short]);
  }
  return [...byTime].map(([time, days]) => `${days.length > 1 ? days.slice(0, -1).join(", ") + " & " + days[days.length - 1] : days[0]} at ${time}`).join(" · ");
}
