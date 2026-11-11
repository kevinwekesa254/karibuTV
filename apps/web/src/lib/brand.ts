// Single place for the product name and public links (BUILD_SPEC 19: name and domain still open).
export const BRAND = {
  name: "Karibu TV",
  short: "Karibu",
  domain: "karibu.tv",
  supportWhatsApp: "+254711855263",
  email: "connect@mrserengeti.com",
};

export const appUrl = () => (typeof window !== "undefined" ? window.location.origin : `https://${BRAND.domain}`);
export const waLink = (number: string, text?: string) =>
  `https://wa.me/${number.replace(/[^\d]/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
