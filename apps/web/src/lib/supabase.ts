import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = !!url && !!anon && !url.includes("YOUR-PROJECT-REF");

/** Host dashboard client: email/password auth, RLS-scoped to the signed-in host. */
export const supabase = createClient(url || "https://example.supabase.co", anon || "public-anon-key", {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "karibu-host-auth" },
});

/** TV client: never signs in; talks to the tv_* / pair_* functions with its device key + secret. */
export const tvClient = createClient(url || "https://example.supabase.co", anon || "public-anon-key", {
  auth: { persistSession: false, autoRefreshToken: false, storageKey: "karibu-tv-auth" },
});

export const MEDIA_BUCKET = "property-media";

/** Public URL for a file in the media bucket (photos, logos). */
export function mediaUrl(path: string | null | undefined) {
  if (!path) return "";
  if (/^(https?:)?\//.test(path)) return path; // bundled sample photos (/templates/…) and absolute URLs
  // Photos are resized to ≤1600 px before upload, so the original is served as-is.
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Upload under <userId>/<propertyId>/<kind>-<timestamp>.<ext> (storage policies require the user-id folder). */
export async function uploadMedia(userId: string, propertyId: string, kind: string, file: File) {
  const ext = file.type === "image/png" ? "png" : file.type === "image/svg+xml" ? "svg" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/${propertyId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) throw error;
  return path;
}

interface PgLikeError { message?: string; code?: string; details?: string; hint?: string; status?: number; context?: { json?: () => Promise<unknown> } }

/** Our database functions raise "plan_limit: …" / "pro_required: …" / "rate_limited: …". */
export function errorCode(err: unknown): string | undefined {
  const m = (err as PgLikeError)?.message || "";
  const hit = /^(plan_limit|pro_required|rate_limited):/.exec(m);
  return hit?.[1];
}

export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const e = err as PgLikeError;
  let m = e?.message || (typeof err === "string" ? err : "");
  if (!m) return fallback;
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "You're offline or the server can't be reached. Check your connection.";
  if (/Invalid login credentials/i.test(m)) return "That email and password don't match. Try again or reset your password.";
  if (/User already registered/i.test(m)) return "That email already has an account. Try signing in instead.";
  if (/duplicate key/i.test(m)) return "That already exists.";
  if (/violates check constraint/i.test(m)) return "One of the values isn't allowed. Check the form and try again.";
  if (/row-level security|permission denied/i.test(m)) return "You don't have access to that.";
  m = m.replace(/^(plan_limit|pro_required|rate_limited):\s*/, "");
  return m;
}

/** Edge Function errors carry the JSON body in error.context. */
export async function functionError(err: unknown): Promise<{ message: string; code?: string }> {
  const ctx = (err as PgLikeError)?.context;
  if (ctx?.json) {
    try { const b = (await ctx.json()) as { message?: string; code?: string }; if (b?.message) return { message: b.message, code: b.code }; } catch { /* ignore */ }
  }
  return { message: errorMessage(err) };
}
