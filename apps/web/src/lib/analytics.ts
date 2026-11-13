// Google Analytics 4, loaded only after the visitor accepts cookies (Kenya Data Protection Act).
// Set VITE_GA_ID (G-XXXXXXX) to switch it on. TV screens, guest guides and unsubscribe links are never tracked,
// and paths are cleaned of IDs and tokens before they're sent.
const GA_ID = (import.meta.env.VITE_GA_ID as string | undefined)?.trim() || "";
const KEY = "kb-cookie-choice";

type Gtag = (...args: unknown[]) => void;
declare global { interface Window { dataLayer?: unknown[]; gtag?: Gtag } }

let loaded = false;

export const analyticsEnabled = () => !!GA_ID;

export function cookieChoice(): "yes" | "no" | null {
  try { const v = localStorage.getItem(KEY); return v === "yes" || v === "no" ? v : null; } catch { return null; }
}

export function setCookieChoice(v: "yes" | "no") {
  try { localStorage.setItem(KEY, v); } catch { /* private mode */ }
  if (v === "yes") load();
}

/** Never track the TV screen, guest guides or unsubscribe links. */
export const untracked = (path: string) => path === "/tv" || path.startsWith("/tv/") || path.startsWith("/g/") || path.startsWith("/unsubscribe");

/** /app/properties/3f2a... -> /app/properties/:id ; /shop/order/1042 -> /shop/order/:number */
export function cleanPath(path: string) {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:id")
    .replace(/^\/shop\/order\/\d+/, "/shop/order/:number")
    .replace(/^\/app\/support\/[^/]+/, "/app/support/:id");
}

function load() {
  if (loaded || !GA_ID || typeof document === "undefined") return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  // gtag must push the real `arguments` object.
  window.gtag = function gtag() { window.dataLayer!.push(arguments); } as Gtag;
  window.gtag("js", new Date());
  window.gtag("config", GA_ID, { send_page_view: false });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(s);
}

export function initAnalytics() { if (cookieChoice() === "yes") load(); }

export function pageView(path: string) {
  if (!loaded || untracked(path)) return;
  const p = cleanPath(path);
  window.gtag?.("event", "page_view", { page_path: p, page_location: `${location.origin}${p}`, page_title: document.title });
}

export function track(event: string, params: Record<string, unknown> = {}) {
  if (!loaded || untracked(location.pathname)) return;
  window.gtag?.("event", event, params);
}

/** One listener for the clicks we care about, so buttons don't each need wiring. */
export function trackClicks() {
  document.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement | null)?.closest?.("a");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    const where = cleanPath(location.pathname);
    if (href === "/signup" || href.startsWith("/signup?")) track("start_free_click", { location: where });
    else if (href.includes("tv.apk")) track("download_tv_app", { location: where });
    else if (href.includes("wa.me/")) track("whatsapp_click", { location: where });
  }, { capture: true });
}
