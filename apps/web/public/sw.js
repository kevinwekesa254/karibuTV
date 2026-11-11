// Karibu TV service worker: keeps the TV usable offline.
// - Photos and logos (/api/files/*): cache-first.
// - App shell (/tv, JS, CSS, fonts): stale-while-revalidate.
// - API calls: network only (the page caches the last ScreenPayload itself).
const FILES = "karibu-files-v1";
const SHELL = "karibu-shell-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(["/tv"]).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => ![FILES, SHELL].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/files/")) {
    e.respondWith(
      caches.open(FILES).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_/")) return;

  // Only the TV route is served from cache; the dashboard always loads fresh.
  const isShell = (req.mode === "navigate" && url.pathname.startsWith("/tv")) || /^\/assets\/.+\.(js|css|woff2?)$/.test(url.pathname);
  if (!isShell) return;
  e.respondWith(
    caches.open(SHELL).then(async (cache) => {
      const key = req.mode === "navigate" ? "/tv" : req;
      const hit = await cache.match(key);
      const network = fetch(req).then((res) => {
        if (res.ok) cache.put(key, res.clone());
        return res;
      }).catch(() => hit);
      return hit || network;
    }),
  );
});
