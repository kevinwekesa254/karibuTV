import type { CSSProperties } from "react";
import "@flaticon/flaticon-uicons/css/regular/rounded.css";
import "@flaticon/flaticon-uicons/css/brands/all.css";

// Icons: Flaticon UIcons (regular rounded), "Uicons by Flaticon" (credited in the footer).
// App names on the left, UIcons names on the right, so the rest of the code never changes.
const MAP: Record<string, string> = {
  // amenities
  wifi: "wifi", tv: "tv-retro", "air-conditioning": "snowflake", "washing-machine": "washer", kitchen: "utensils",
  parking: "parking", "hot-shower": "shower", "pool-beach": "swimmer", bedroom: "bed",
  // house rules
  "no-smoking": "smoking-ban", "no-parties": "glass-cheers", "no-pets": "paw", quiet: "volume-mute", guests: "users",
  shoes: "shoe-prints", key: "key", trash: "trash", clock: "clock", info: "info", lock: "lock", sun: "sun",
  bulb: "bulb", water: "raindrops", door: "door-open", dishes: "plate", broom: "broom",
  // interface
  home: "home", calendar: "calendar", more: "menu-dots", menu: "menu-burger", settings: "settings", card: "credit-card",
  building: "building", plus: "plus", check: "check", x: "cross", "chevron-right": "angle-right", "chevron-left": "angle-left",
  "chevron-down": "angle-down", "arrow-up": "arrow-up", "arrow-down": "arrow-down", "arrow-right": "arrow-right",
  edit: "edit", delete: "trash", drag: "grip-dots-vertical", logout: "sign-out-alt", refresh: "refresh", copy: "copy",
  eye: "eye", "eye-off": "eye-crossed", link: "link", image: "picture", upload: "upload", phone: "phone-call",
  sparkle: "sparkles", offline: "wifi-slash", qr: "qrcode", pin: "marker", star: "star", play: "play", globe: "globe",
  mail: "envelope", palette: "palette", clipboard: "clipboard-list", "tv-signal": "screen", search: "search",
  help: "interrogation", bell: "bell", download: "download", pencil: "pencil", bolt: "bolt", shield: "shield-check",
  admin: "user-shield", chart: "chart-histogram", megaphone: "megaphone", user: "user", users: "users", crown: "crown", ban: "ban", bag: "shopping-bag", truck: "truck-side", box: "box-alt",
  // weather
  clearsky: "sun", fair: "cloud-sun", cloudy: "cloud", rain: "cloud-rain", thunder: "thunderstorm", fog: "fog",
};

const WEATHER_MAP: [RegExp, string][] = [
  [/thunder/, "thunder"], [/rain|sleet|snow|showers/, "rain"], [/fog/, "fog"],
  [/partlycloudy|fair/, "fair"], [/cloudy/, "cloudy"], [/clearsky/, "clearsky"],
];
export const weatherIcon = (symbol: string) => WEATHER_MAP.find(([re]) => re.test(symbol))?.[1] || "fair";

export const AMENITIES: { key: string; label: string }[] = [
  { key: "wifi", label: "Wi-Fi" },
  { key: "tv", label: "TV" },
  { key: "air-conditioning", label: "Air conditioning" },
  { key: "washing-machine", label: "Washing machine" },
  { key: "kitchen", label: "Kitchen" },
  { key: "parking", label: "Parking" },
  { key: "hot-shower", label: "Hot shower" },
  { key: "pool-beach", label: "Pool / beach" },
  { key: "bedroom", label: "Bedroom" },
];

export const RULE_ICONS = [
  "no-smoking", "no-parties", "no-pets", "quiet", "guests", "shoes", "key", "trash",
  "clock", "lock", "bulb", "water", "door", "dishes", "sun", "broom", "info",
];

type IconProps = { name: string; size?: number; strokeWidth?: number; className?: string; style?: CSSProperties; "aria-label"?: string };

/** `strokeWidth` is accepted for compatibility with the old SVG icons and ignored (font icons). */
export function Icon({ name, size = 20, className = "", style, ...rest }: IconProps) {
  const label = rest["aria-label"];
  return (
    <i className={`fi fi-rr-${MAP[name] || "info"} inline-flex shrink-0 items-center justify-center leading-none ${className}`}
      style={{ fontSize: size, width: size, height: size, ...style }} aria-hidden={label ? undefined : true} aria-label={label} role={label ? "img" : undefined} />
  );
}

export function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return <i className="fi fi-brands-whatsapp inline-flex shrink-0 items-center justify-center leading-none" style={{ fontSize: size, width: size, height: size }} aria-hidden />;
}
