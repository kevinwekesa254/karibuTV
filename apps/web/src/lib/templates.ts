// Ready-made looks by kind of stay. Each sets a layout and theme, and offers a Kenyan sample photo
// for hosts who haven't uploaded their own yet. Photos: public/templates (see CREDITS.txt).
import type { Layout, ThemeName } from "./types";

export interface Template {
  key: string; label: string; blurb: string;
  layout: Layout; theme: ThemeName; photo: string | null;
}

export const TEMPLATES: Template[] = [
  { key: "coast", label: "Coast", blurb: "Beach houses, ocean views, Diani to Watamu", layout: "fullphoto", theme: "coast", photo: "/templates/coast.jpg" },
  { key: "safari", label: "Safari Lodge", blurb: "Lodges, tented camps and bush cottages", layout: "spotlight", theme: "safari", photo: "/templates/safari.jpg" },
  { key: "city", label: "City Apartment", blurb: "Kilimani, Westlands and city stays", layout: "classic", theme: "city", photo: "/templates/city.jpg" },
  { key: "minimal", label: "Minimal", blurb: "Clean and calm. Lets your words do the talking", layout: "minimal", theme: "karibu", photo: null },
];

export const SAMPLE_PHOTOS = TEMPLATES.map((t) => t.photo).filter(Boolean) as string[];

/** Which template a property currently matches, if any. */
export function currentTemplate(p: { layout?: string; theme?: string }) {
  return TEMPLATES.find((t) => t.layout === p.layout && t.theme === p.theme)?.key ?? null;
}
