# Karibu TV design system

Brevo-inspired: mint bands with big rounded corners, deep-forest headings, near-black buttons, a semibold grotesk display face.

- `tokens.css` — CSS variables for light (default) and `data-theme="dark"` (TV, dashboard dark mode).
- `components.css` — `.kb-*` component classes (buttons, cards, tags, fields, bands).
- `tailwind.preset.js` — maps the tokens to Tailwind (`bg-mint`, `text-forest`, `rounded-band`, `font-display`, `text-display-xl`…).

Fonts: Familjen Grotesk (headings) and Inter (text), both SIL OFL, bundled via `@fontsource` in the web app (Latin subset only).

## Rules
- One primary (ink) button per view; secondary buttons are outlined.
- Headings in `forest`, body in `ink`, secondary text in `ink-muted`. Eyebrows: uppercase, `green`, 12–13 px, tracking 0.08em.
- Bands: `mint` for hero/CTA, `mint-soft` for secondary; radius 48 (bottom of hero) or 80 (top of closing band).
- Cards: `surface`, 1 px `line` border, radius 16–24, no heavy shadows.
- TV: always dark, 1920×1080 stage, 96 px safe margins, text ≥ 28 px, no motion beyond a 1 s cross-fade.
