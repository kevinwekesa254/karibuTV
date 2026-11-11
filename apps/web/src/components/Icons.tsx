import type { SVGProps } from "react";

// 24×24 stroke icons. Paths are drawn for this project (no external icon font).
const P: Record<string, string> = {
  // amenities
  wifi: "M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01",
  tv: "M3 5h18v12H3zM8 21h8M12 17v4",
  "air-conditioning": "M3 5h18v7H3zM6 9h12M7 15v1.5M12 15v4M17 15v1.5",
  "washing-machine": "M4 3h16v18H4zM4 7h16M7 5h.01M10 5h.01M12 10.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z",
  kitchen: "M6 3v8a2 2 0 0 0 2 2v8M10 3v8M6 7h4M16 3c-1.7 1.3-2.5 3.3-2.5 6 0 1.6.9 3 2.5 3v9",
  parking: "M5 3h14v18H5zM9.5 17V7H13a3 3 0 0 1 0 6H9.5",
  "hot-shower": "M4 21V8a5 5 0 0 1 10 0M11 8h6M9 13v.01M12 13v.01M15 13v.01M10 16.5v.01M13 16.5v.01M11.5 20v.01",
  "pool-beach": "M2 18c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5M8 15V5a2 2 0 0 1 4 0M16 15V5a2 2 0 0 0-4 0M8 8h8M8 12h8",
  bedroom: "M3 19V6M3 14h18v5M21 14v-3a3 3 0 0 0-3-3h-7v6M6.5 10.5a1.5 1.5 0 1 0 0 .01",
  // house rules
  "no-smoking": "M3 3l18 18M3 14h11M18 14h3v3h-1M14 17H3v-3M17 7c0-2-1.5-2-1.5-4M20 7c0-2-1.5-2-1.5-4",
  "no-parties": "M3 3l18 18M8.5 8.5L5 21l12.5-3.5M14 4l1 1M18 8l2-1M19 4l1-1M11 4c1 1.5 1 2.5 0 4",
  "no-pets": "M3 3l18 18M7 9.5a1.5 2 0 1 0 0 .01M11 6a1.5 2 0 1 0 0 .01M17 9.5a1.5 2 0 1 0 0 .01M8 17c0-2.5 2-4.5 4-4.5 1.2 0 2.3.6 3 1.6M16 17.5c-.5 1-2 1.5-4 1.5s-4-.5-4-2",
  quiet: "M11 5L6 9H3v6h3l5 4zM16 9l5 6M21 9l-5 6",
  guests: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6",
  shoes: "M3 18h18v-2c0-1-1-2-3-2.5l-4-1-2-4H6L3 10zM3 14h7",
  key: "M15 7a4 4 0 1 0-3.9 5L4 19v2h3v-2h2v-2h2l1.9-1.9A4 4 0 0 0 15 7zM16 7h.01",
  trash: "M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5h.01",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  bulb: "M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z",
  water: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z",
  door: "M5 21V3h11v18M16 5h3v16M12.5 12h.01M3 21h18",
  dishes: "M4 12a8 8 0 0 0 16 0zM2 12h20M12 4v3",
  // ui
  home: "M3 10.5L12 3l9 7.5V21h-6v-6H9v6H3z",
  calendar: "M4 5h16v16H4zM4 10h16M9 3v4M15 3v4",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  menu: "M4 6h16M4 12h16M4 18h16",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  card: "M2 6h20v13H2zM2 10h20M6 15h4",
  building: "M4 21V5l8-3v19M12 9h8v12M7 8h2M7 12h2M7 16h2M15 13h2M15 17h2M2 21h20",
  plus: "M12 5v14M5 12h14",
  check: "M5 12.5l4.5 4.5L19 7",
  x: "M6 6l12 12M18 6L6 18",
  "chevron-right": "M9 6l6 6-6 6",
  "chevron-left": "M15 6l-6 6 6 6",
  "chevron-down": "M6 9l6 6 6-6",
  "arrow-up": "M12 19V5M6 11l6-6 6 6",
  "arrow-down": "M12 5v14M6 13l6 6 6-6",
  "arrow-right": "M5 12h14M13 6l6 6-6 6",
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  delete: "M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3",
  drag: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
  logout: "M15 4h4v16h-4M10 17l5-5-5-5M15 12H3",
  refresh: "M20 11a8 8 0 0 0-14.8-4M4 4v4h4M4 13a8 8 0 0 0 14.8 4M20 20v-4h-4",
  copy: "M8 8h12v12H8zM16 8V4H4v12h4",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  "eye-off": "M3 3l18 18M10.6 5.1A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  image: "M3 4h18v16H3zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 20",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
  phone: "M8 2h8a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM11 18h2",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 3v4M17 5h4",
  offline: "M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M2 8.5a15 15 0 0 1 4.2-2.9M10.7 5.1A15 15 0 0 1 22 8.5M5 12a10 10 0 0 1 4-2.4M16.4 11a10 10 0 0 1 2.6 1M12 20h.01",
  qr: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4h-4M6 6h.01M17 6h.01M6 17h.01",
  pin: "M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  star: "M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4l-5.5 2.9 1-6.2L3 9.7l6.2-.9z",
  play: "M7 4l13 8-13 8z",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18",
  mail: "M3 5h18v14H3zM3 6l9 7 9-7",
  palette: "M12 21a9 9 0 1 1 9-9c0 2.5-2 3.5-4 3.5h-1.5a1.5 1.5 0 0 0-1 2.6c.6.6.5 2.9-2.5 2.9zM7.5 11.5h.01M10 7.5h.01M15 7.5h.01",
  clipboard: "M9 4h6v3H9zM9 5H5v16h14V5h-4M8.5 13.5l2.5 2.5 4.5-5",
  "tv-signal": "M3 5h18v12H3zM8 21h8M12 17v4M9.5 10.5a3.5 3.5 0 0 1 5 0M11 12.5a1.4 1.4 0 0 1 2 0M12 14.5h.01",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
  download: "M12 4v12M7 11l5 5 5-5M4 20h16",
  pencil: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  // weather
  clearsky: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  fair: "M8 3v1.5M3.5 8H2M4.8 4.8l1 1M12.5 9.5a4.5 4.5 0 0 0-8.4 1.8M7 20h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 20z",
  cloudy: "M7 19h10a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.5 1.6A3.7 3.7 0 0 0 7 19z",
  rain: "M7 15h10a4 4 0 0 0 .4-8A5.5 5.5 0 0 0 6.9 8.5 3.3 3.3 0 0 0 7 15zM8 18l-1 3M12 18l-1 3M16 18l-1 3",
  thunder: "M7 14h10a4 4 0 0 0 .4-8A5.5 5.5 0 0 0 6.9 7.5 3.3 3.3 0 0 0 7 14zM13 14l-2.5 4h3L11 22",
  fog: "M4 10h16M4 14h16M6 18h12M7 6h10",
};

const WEATHER_MAP: [RegExp, string][] = [
  [/thunder/, "thunder"], [/rain|sleet|snow|showers/, "rain"], [/fog/, "fog"],
  [/partlycloudy|fair/, "fair"], [/cloudy/, "cloudy"], [/clearsky/, "clearsky"],
];
export const weatherIcon = (symbol: string) => WEATHER_MAP.find(([re]) => re.test(symbol))?.[1] || "fair";

export const AMENITIES: { key: string; label: string; sw: string }[] = [
  { key: "wifi", label: "Wi-Fi", sw: "Wi-Fi" },
  { key: "tv", label: "TV", sw: "TV" },
  { key: "air-conditioning", label: "Air conditioning", sw: "Kiyoyozi" },
  { key: "washing-machine", label: "Washing machine", sw: "Mashine ya kufulia" },
  { key: "kitchen", label: "Kitchen", sw: "Jikoni" },
  { key: "parking", label: "Parking", sw: "Maegesho" },
  { key: "hot-shower", label: "Hot shower", sw: "Bafu la maji moto" },
  { key: "pool-beach", label: "Pool / beach", sw: "Bwawa / ufukwe" },
  { key: "bedroom", label: "Bedroom", sw: "Chumba cha kulala" },
];

export const RULE_ICONS = [
  "no-smoking", "no-parties", "no-pets", "quiet", "guests", "shoes", "key", "trash",
  "clock", "lock", "bulb", "water", "door", "dishes", "sun", "info",
];

export function Icon({ name, size = 20, strokeWidth = 1.8, ...rest }: { name: string; size?: number; strokeWidth?: number } & SVGProps<SVGSVGElement>) {
  const d = P[name] || P.info;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      <path d={d} />
    </svg>
  );
}

export function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.6-.3z" />
    </svg>
  );
}
