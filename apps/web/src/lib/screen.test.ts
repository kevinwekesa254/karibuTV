// Run: npm test (node --test with native TypeScript type stripping)
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPayload, computeState, wifiQrString } from "./screen.ts";
import { parseIcal, bookings } from "../../../../supabase/functions/_shared/ical.ts";

// Nairobi is UTC+3.
const at = (date: string, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  const [y, mo, d] = date.split("-").map(Number);
  return Date.UTC(y, mo - 1, d, h, m) - 3 * 3600_000;
};
const run = (stays: { first_name: string; checkin: string; checkout: string; cancelled?: boolean }[], date: string, time: string) =>
  computeState({ stays, timezone: "Africa/Nairobi", checkoutTime: "11:00", nowMs: at(date, time) });

const priya = { first_name: "Christine", checkin: "2026-11-10", checkout: "2026-11-13" };
const tom = { first_name: "Tom", checkin: "2026-11-13", checkout: "2026-11-15" };

test("no stays → between", () => assert.equal(run([], "2026-11-10", "12:00").state, "between"));
test("arrival day counts from midnight", () => assert.equal(run([priya], "2026-11-10", "00:05").state, "arriving"));
test("middle of stay", () => assert.equal(run([priya], "2026-11-11", "20:00").state, "arriving"));
test("check-out day until 2 h after check-out time", () => {
  assert.equal(run([priya], "2026-11-13", "08:00").state, "checkout");
  assert.equal(run([priya], "2026-11-13", "12:59").state, "checkout");
  assert.equal(run([priya], "2026-11-13", "13:00").state, "between");
});
test("back-to-back switches at check-out time", () => {
  assert.equal(run([priya, tom], "2026-11-13", "10:59").stay?.first_name, "Christine");
  assert.equal(run([priya, tom], "2026-11-13", "11:00").stay?.first_name, "Tom");
  assert.equal(run([priya, tom], "2026-11-13", "11:00").state, "arriving");
});
test("cancelled stays are ignored", () => assert.equal(run([{ ...priya, cancelled: true }], "2026-11-11", "12:00").state, "between"));
test("empty name still arrives", () => assert.equal(run([{ ...priya, first_name: "" }], "2026-11-11", "12:00").stay?.first_name, ""));
test("near midnight stays on the previous day", () => {
  assert.equal(run([priya], "2026-11-09", "23:30").state, "between");
  assert.equal(run([priya], "2026-11-10", "00:00").state, "arriving");
});
test("Kigali uses UTC+2", () => {
  const nowMs = Date.UTC(2026, 10, 9, 21, 30); // 23:30 Kigali, 00:30 Nairobi
  assert.equal(computeState({ stays: [priya], timezone: "Africa/Kigali", nowMs }).state, "between");
  assert.equal(computeState({ stays: [priya], timezone: "Africa/Nairobi", nowMs }).state, "arriving");
});
test("next_change_at", () => {
  assert.equal(run([priya], "2026-11-13", "08:00").next_change_at, at("2026-11-13", "11:00"));
  assert.equal(run([priya], "2026-11-13", "12:00").next_change_at, at("2026-11-13", "13:00"));
  assert.equal(run([priya], "2026-11-13", "14:00").next_change_at, at("2026-11-14", "00:00"));
});
test("wifi QR escaping", () => {
  assert.equal(wifiQrString("WPA", "Casa;Mara", 'p:a,s"s\\'), 'WIFI:T:WPA;S:Casa\\;Mara;P:p\\:a\\,s\\"s\\\\;;');
  assert.equal(wifiQrString("nopass", "Open", "x"), "WIFI:T:nopass;S:Open;P:;;");
});
test("hidden password stays inside the QR", () => {
  const p = buildPayload({ property: { name: "Casa", wifi_ssid: "Casa", wifi_password: "secret123", show_wifi_password: false }, stays: [priya], plan: { pro: false }, nowMs: at("2026-11-11", "12:00"), mediaUrl: (x) => x });
  assert.equal(p.wifi.password, null);
  assert.match(p.wifi.qr_string, /secret123/);
  assert.equal(p.stay?.nights, 3);
  assert.equal(p.plan.branded, true);
});
test("restricted TV shows the between screen", () => {
  assert.equal(buildPayload({ property: { name: "Casa" }, stays: [priya], plan: { pro: true }, nowMs: at("2026-11-11", "12:00"), mediaUrl: (x) => x, restricted: true }).state, "between");
});
test("preview forces a state with a sample guest", () => {
  const p = buildPayload({ property: { name: "Casa" }, stays: [], plan: { pro: true }, nowMs: at("2026-11-11", "12:00"), mediaUrl: (x) => x, forceState: "checkout", sampleName: "Guest" });
  assert.equal(p.state, "checkout");
  assert.equal(p.stay?.first_name, "Guest");
});
test("iCal: bookings only", () => {
  const feed = ["BEGIN:VCALENDAR",
    "BEGIN:VEVENT", "UID:abc@airbnb.com", "DTSTART;VALUE=DATE:20261110", "DTEND;VALUE=DATE:20261113", "SUMMARY:Reserved", "END:VEVENT",
    "BEGIN:VEVENT", "UID:blk", "DTSTART;VALUE=DATE:20261120", "DTEND;VALUE=DATE:20261122", "SUMMARY:Airbnb (Not available)", "END:VEVENT",
    "BEGIN:VEVENT", "UID:cx", "DTSTART:20261201T140000Z", "DTEND:20261203T100000Z", "STATUS:CANCELLED", "END:VEVENT",
    "END:VCALENDAR"].join("\r\n");
  const b = bookings(parseIcal(feed));
  assert.equal(b.length, 1);
  assert.deepEqual([b[0].uid, b[0].checkin, b[0].checkout], ["abc@airbnb.com", "2026-11-10", "2026-11-13"]);
  assert.throws(() => parseIcal("<html>404</html>"));
});
