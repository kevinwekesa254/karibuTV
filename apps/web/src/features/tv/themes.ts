// TV colour presets. All dark grounds (burn-in, readability across a room).
export interface TvTheme {
  key: string; label: string;
  bg: string; panel: string; panelLine: string; text: string; muted: string;
  accent: string; onAccent: string; chip: string;
}

function hexToRgb(h: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec((h || "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mix(h: string, other: string, amt: number) {
  const a = hexToRgb(h), b = hexToRgb(other);
  if (!a || !b) return h;
  return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * amt).toString(16).padStart(2, "0")).join("");
}
function luminance(h: string) {
  const c = hexToRgb(h);
  if (!c) return 0;
  const [r, g, b] = c.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function make(key: string, label: string, bg: string, accent: string): TvTheme {
  return {
    key, label, bg, accent,
    panel: mix(bg, "#ffffff", 0.06), panelLine: mix(bg, "#ffffff", 0.14), chip: mix(bg, "#ffffff", 0.09),
    text: "#f7f5f2", muted: mix("#f7f5f2", bg, 0.32),
    onAccent: luminance(accent) > 0.35 ? "#16110f" : "#ffffff",
  };
}

export const THEMES: Record<string, TvTheme> = {
  karibu: { ...make("karibu", "Karibu", "#0c1f16", "#c0ffa5"), text: "#f2fff0", muted: "#a9bfb2", panel: "#10291d", panelLine: "#24402f", chip: "#173a28" },
  maroon: make("maroon", "Maroon & gold", "#2a0c13", "#f2b85c"),
  midnight: make("midnight", "Midnight", "#0d1730", "#f5b942"),
  teal: make("teal", "Deep teal", "#0a3433", "#f2b85c"),
  forest: make("forest", "Forest", "#122a1a", "#e8c26a"),
  charcoal: make("charcoal", "Charcoal", "#1c1c1e", "#f59e0b"),
  plum: make("plum", "Plum", "#2b1033", "#e9a8f2"),
  espresso: make("espresso", "Espresso", "#2a1a10", "#f2a65c"),
  ocean: make("ocean", "Ocean", "#0a2540", "#7fdcff"),
};

export function resolveTheme(name: string, bg?: string, accent?: string): TvTheme {
  if (name === "custom" && bg && hexToRgb(bg)) {
    const ground = luminance(bg) > 0.18 ? mix(bg, "#000000", 0.6) : bg; // keep text readable
    return make("custom", "Custom", ground, accent && hexToRgb(accent) ? accent : "#f2b85c");
  }
  return THEMES[name] || THEMES.karibu;
}
