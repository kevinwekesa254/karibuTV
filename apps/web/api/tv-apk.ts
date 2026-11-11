// Serves the Karibu TV Android app at /tv.apk (see vercel.json). The file lives on the latest
// GitHub release; this streams it from our own domain with download headers, so a TV's
// Downloader app (or browser) gets the APK directly and never lands on GitHub.
export const config = { runtime: "edge" };

const SOURCE = "https://github.com/kevinwekesa254/karibuTV/releases/latest/download/karibu-tv.apk";

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
  const upstream = await fetch(SOURCE, { redirect: "follow" });
  if (!upstream.ok || !upstream.body) {
    return new Response("The Karibu TV app isn't available for download yet. Please try again later.", {
      status: upstream.status === 404 ? 404 : 502,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  const headers = new Headers({
    "Content-Type": "application/vnd.android.package-archive",
    "Content-Disposition": 'attachment; filename="karibu-tv.apk"',
    "Cache-Control": "public, max-age=0, s-maxage=600",
    "X-Content-Type-Options": "nosniff",
  });
  const len = upstream.headers.get("content-length");
  if (len) headers.set("Content-Length", len);
  return new Response(req.method === "HEAD" ? null : upstream.body, { status: 200, headers });
}
