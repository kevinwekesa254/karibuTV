// Hosts connect their own AI account. Host JWT required.
//   POST { action: "save", provider: "anthropic" | "openai", key, model? } -> { provider, model, hint }
//   POST { action: "delete" }
// The key is checked against the provider, encrypted, and never returned.
import { admin, caller, cors, json } from "../_shared/supabase.ts";
import { encrypt } from "../_shared/crypto.ts";
import { AiError, verifyKey, type Provider } from "../_shared/ai.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { userId } = await caller(req);
    if (!userId) return json({ error: "Sign in first." }, 401);
    const body = await req.json().catch(() => ({}));
    const db = admin();

    if (body.action === "delete") {
      await db.from("ai_keys").delete().eq("user_id", userId);
      return json({ ok: true });
    }
    if (body.action !== "save") return json({ error: "Bad request." }, 400);
    const provider = body.provider as Provider;
    const key = String(body.key || "").trim();
    if (!["anthropic", "openai"].includes(provider) || !key || key.length > 300) return json({ error: "Choose Claude or OpenAI and paste your key." }, 400);

    // At most 10 key checks per host per hour (stops this endpoint being used to test stolen keys).
    const since = new Date(Date.now() - 3600e3).toISOString();
    const { count } = await db.from("ai_usage").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("mode", "key_check").gte("created_at", since);
    if ((count || 0) >= 10) return json({ error: "Too many tries. Wait an hour and try again." }, 429);
    await db.from("ai_usage").insert({ user_id: userId, mode: "key_check" });

    const model = await verifyKey(provider, key, typeof body.model === "string" ? body.model : undefined);
    const hint = key.slice(-4);
    const { error } = await db.from("ai_keys").upsert({
      user_id: userId, provider, model, key_cipher: await encrypt(key), key_hint: hint, verified_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return json({ provider, model, hint });
  } catch (e) {
    if (e instanceof AiError) return json({ error: e.message }, e.status);
    return json({ error: (e as Error).message || "Something went wrong." }, 500);
  }
});
