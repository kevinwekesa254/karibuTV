// Minimal iCal (RFC 5545) VEVENT parser for booking feeds (BUILD_SPEC 8.4).
export interface IcalEvent { uid: string; checkin: string; checkout: string; summary: string; status: string }

const BLOCK_RE = /(not available|blocked|closed|unavailable)/i;

const unfold = (t: string) => t.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n[ \t]/g, "");
const icalDate = (v: string) => { const m = /^(\d{4})(\d{2})(\d{2})/.exec(v.trim()); return m ? `${m[1]}-${m[2]}-${m[3]}` : ""; };
const unescape = (v: string) => v.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();

export function parseIcal(text: string): IcalEvent[] {
  const src = unfold(text || "");
  if (!src.includes("BEGIN:VCALENDAR")) throw new Error("This link does not return a calendar (no BEGIN:VCALENDAR).");
  const events: Partial<IcalEvent>[] = [];
  let cur: Partial<IcalEvent> | null = null;
  for (const line of src.split("\n")) {
    if (line === "BEGIN:VEVENT") { cur = {}; continue; }
    if (line === "END:VEVENT") { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const i = line.indexOf(":");
    if (i < 0) continue;
    const key = line.slice(0, i).split(";")[0].toUpperCase();
    const val = line.slice(i + 1);
    if (key === "UID") cur.uid = val.trim();
    else if (key === "DTSTART") cur.checkin = icalDate(val);
    else if (key === "DTEND") cur.checkout = icalDate(val);
    else if (key === "SUMMARY") cur.summary = unescape(val);
    else if (key === "STATUS") cur.status = val.trim().toUpperCase();
  }
  return events.map((e) => {
    let checkout = e.checkout || "";
    if (e.checkin && !checkout) {
      const [y, m, d] = e.checkin.split("-").map(Number);
      checkout = new Date(Date.UTC(y, m - 1, d) + 86400000).toISOString().slice(0, 10);
    }
    return { uid: e.uid || "", checkin: e.checkin || "", checkout, summary: e.summary || "", status: e.status || "" };
  });
}

/** Real bookings only: no owner blocks, no cancellations, valid dates. */
export const bookings = (events: IcalEvent[]) =>
  events.filter((e) => e.uid && e.checkin && e.checkout && e.checkin < e.checkout && e.status !== "CANCELLED" && !BLOCK_RE.test(e.summary));
