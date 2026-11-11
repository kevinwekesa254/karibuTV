/** Tailwind preset mapping design/tokens.css to utilities: bg-mint, text-forest, rounded-band, font-display… */
const v = (name) => `var(--${name})`;
// Colours support opacity modifiers (bg-danger/10): plain var() at full opacity, color-mix otherwise.
const c = (name) => ({ opacityValue }) =>
  opacityValue === undefined || opacityValue === "1" || opacityValue === 1
    ? `var(--${name})`
    : `color-mix(in srgb, var(--${name}) calc(${opacityValue} * 100%), transparent)`;
module.exports = {
  theme: {
    extend: {
      colors: Object.fromEntries([
        "mint", "mint-soft", "on-mint", "forest", "green", "ink", "on-ink", "ink-muted",
        "surface", "surface-wash", "line", "line-strong", "cream", "danger", "warning",
        "sun", "sun-soft", "on-sun", "sun-ink", "gold", "ocean", "maroon", "maroon-deep", "navy", "bone", "ember",
      ].map((n) => [n, c(n)])),
      borderRadius: {
        sm: v("radius-sm"), md: v("radius-md"), lg: v("radius-lg"),
        band: v("radius-band"), "band-xl": v("radius-band-xl"),
      },
      fontFamily: { display: v("font-display").split(","), sans: v("font-text").split(","), tv: v("font-tv").split(",") },
      boxShadow: { card: v("shadow-card"), panel: v("shadow-panel") },
      fontSize: {
        "display-xl": ["clamp(2.5rem, 6vw, 4.5rem)", { lineHeight: "1.02", letterSpacing: "-0.02em", fontWeight: "600" }],
        "display-lg": ["clamp(2rem, 4.5vw, 3.25rem)", { lineHeight: "1.05", letterSpacing: "-0.02em", fontWeight: "600" }],
        "display-md": ["clamp(1.75rem, 3.5vw, 2.5rem)", { lineHeight: "1.1", letterSpacing: "-0.015em", fontWeight: "600" }],
        "display-sm": ["1.5rem", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "600" }],
      },
    },
  },
};
