// AES-GCM encryption for secrets we store for hosts (their AI API keys).
// AI_KEYS_SECRET is a long random string set with `supabase secrets set`; rotating it invalidates stored keys.
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function key() {
  const secret = Deno.env.get("AI_KEYS_SECRET");
  if (!secret || secret.length < 32) throw new Error("AI_KEYS_SECRET is not set (32+ characters).");
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(secret));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encrypt(plain: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), enc.encode(plain)));
  return `v1.${b64(iv)}.${b64(ct)}`;
}

export async function decrypt(token: string) {
  const [v, iv, ct] = token.split(".");
  if (v !== "v1" || !iv || !ct) throw new Error("Unreadable stored key.");
  return dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await key(), unb64(ct)));
}
