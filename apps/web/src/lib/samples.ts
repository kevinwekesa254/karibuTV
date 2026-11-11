import type { ScreenPayload } from "./types";
import { addDays, todayIn } from "./dates";

/** Sample ScreenPayload for the landing page and empty previews. */
export function samplePayload(over: Omit<Partial<ScreenPayload>, "property"> & { property?: Partial<ScreenPayload["property"]> } = {}): ScreenPayload {
  const t = todayIn("Africa/Nairobi");
  const { property, ...rest } = over;
  return {
    state: "arriving",
    now: new Date().toISOString(),
    next_change_at: new Date(Date.now() + 3600e3).toISOString(),
    plan: { pro: true, branded: false, logo: false, weather: true },
    property: {
      name: "Casa Mara", tagline: "2-bed · Ocean view · Fast Wi-Fi", area: "Diani Beach", timezone: "Africa/Nairobi",
      checkin_time: "14:00", checkout_time: "11:00", quiet_start: "22:00", quiet_end: "07:00", max_guests: 4,
      amenities: ["wifi", "air-conditioning", "kitchen", "hot-shower", "pool-beach", "parking"],
      house_rules: [{ icon: "no-smoking", text: "No smoking" }, { icon: "no-parties", text: "No parties" }],
      checkout_steps: ["Leave the keys on the kitchen table", "Switch off the AC and lights", "Put used towels in the bathroom", "Close the windows and lock the door"],
      host_name: "Amina", host_contact: "+254 712 345 678",
      welcome_title: "", welcome_note: "We hope you love the ocean breeze. Fresh towels are in the cupboard.",
      generic_title: "", generic_note: "", thankyou_line: "Thank you for staying at Casa Mara!",
      contact_title: "Safe travels!", contact_line: "Message Amina on WhatsApp if you left anything behind.",
      layout: "classic", theme: "karibu", photo_url: null, logo_url: null, logo_position: "header",
      review_url: "https://www.airbnb.com/", motion: true,
      picks: [
        { title: "Ali Barbour's Cave", note: "Dinner in a coral cave · 10 min", url: "" },
        { title: "Colobus Conservation", note: "Monkey walks every morning", url: "" },
        { title: "Kongo River mouth", note: "Quiet beach at sunset", url: "" },
      ],
      extras: [{ title: "Airport transfer", price: "KES 3,500" }, { title: "Late check-out", price: "KES 2,000" }],
      cleaning: [{ day: "tue", time: "10:00", note: "Fresh towels and bedding" }, { day: "fri", time: "10:00", note: "" }],
      ...property,
    },
    wifi: { ssid: "CasaMara_5G", password: "karibu2026", security: "WPA", qr_string: "WIFI:T:WPA;S:CasaMara_5G;P:karibu2026;;" },
    stay: { first_name: "Christine", checkin: t, checkout: addDays(t, 3), nights: 3 },
    weather: {
      place: "Diani Beach", today: { temp_c: 29, symbol: "fair" },
      days: [1, 2, 3].map((n, i) => ({ date: addDays(t, n), min_c: 24 + (i % 2), max_c: 30 + i, symbol: ["clearsky", "partlycloudy", "rainshowers"][i] })),
    },
    ...rest,
  };
}
