// Screen strings. English only for now (BUILD_SPEC 18 Swahili is parked until later).
const en: Record<string, string> = {
  greeting: "Welcome, {name}!",
  greeting_noname: "Welcome!",
  your_stay: "Your stay",
  nights: "{n} nights",
  night: "1 night",
  checkout: "Check-out",
  checkout_today: "Check-out today by {time}",
  checkout_steps: "Before you leave",
  safe_travels: "Safe travels, {name}",
  safe_travels_noname: "Safe travels",
  thank_you: "Thank you for staying with us.",
  wifi_title: "Connect to Wi-Fi",
  wifi_scan: "Scan with your phone camera",
  network: "Network",
  password: "Password",
  open_network: "No password needed",
  ask_host_password: "Ask your host for the password",
  need_anything: "Need anything? WhatsApp {host}",
  max_guests: "Max {n} guests",
  quiet_hours: "Quiet hours {from}–{to}",
  weather: "Weather",
  today: "Today",
  renew: "Ask your host to renew Karibu TV",
  welcome_to: "Welcome to {name}",
};

export function t(key: string, vars: Record<string, string | number> = {}) {
  let s = en[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
export type T = typeof t;
