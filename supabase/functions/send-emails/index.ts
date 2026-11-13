// Delivers the email queue through Brevo. Woken every minute by pg_cron (public.email_kick) with a shared
// secret that lives only in the database. Secrets: BREVO_API_KEY (required), BREVO_LIST_ID (newsletter list,
// optional), EMAIL_FROM, EMAIL_REPLY_TO, EMAIL_DAILY_CAP (Brevo free plan: 300 a day).
import { admin, json } from "../_shared/supabase.ts";
import { render, type Ctx } from "./templates.ts";

const HOST_APP = Deno.env.get("HOST_APP_URL") || "https://tv.mrserengeti.com";
const ADMIN_APP = Deno.env.get("ADMIN_APP_URL") || "https://admintv.mrserengeti.com";
const FROM = Deno.env.get("EMAIL_FROM") || "Karibu TV <hello@mrserengeti.com>";
const REPLY_TO = Deno.env.get("EMAIL_REPLY_TO") || "connect@mrserengeti.com";
const CAP = Number(Deno.env.get("EMAIL_DAILY_CAP") || 290);
const BREVO = "https://api.brevo.com/v3";

interface Row { id: string; template: string; to_email: string; to_name: string; user_id: string | null; data: Record<string, unknown>; kind: Ctx["kind"]; attempts: number }

const sender = () => {
  const m = FROM.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/);
  return m ? { name: m[1] || "Karibu TV", email: m[2] } : { name: "Karibu TV", email: FROM.trim() };
};

async function brevo(path: string, body: unknown, key: string) {
  const r = await fetch(`${BREVO}${path}`, { method: "POST", headers: { "api-key": key, "Content-Type": "application/json", accept: "application/json" }, body: JSON.stringify(body) });
  const text = await r.text();
  if (!r.ok) throw new Error(`Brevo ${r.status}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text || "{}"); } catch { return {}; }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const db = admin();
  const { data: priv } = await db.from("email_private").select("cron_secret").eq("id", 1).single();
  const secret = req.headers.get("x-cron-secret") || "";
  if (!priv?.cron_secret || secret.length < 32 || secret !== priv.cron_secret) return json({ error: "Not allowed" }, 401);

  const key = (Deno.env.get("BREVO_API_KEY") || Deno.env.get("BREVO-API_KEY") || "").trim();
  if (!key) return json({ ok: false, reason: "BREVO_API_KEY is not set; emails stay queued." });

  const since = new Date(); since.setUTCHours(0, 0, 0, 0);
  const { count } = await db.from("email_outbox").select("id", { count: "exact", head: true })
    .eq("status", "sent").not("template", "like", "\\_%").gte("sent_at", since.toISOString());
  const room = Math.max(0, CAP - (count || 0));

  const { data: batch, error } = await db.rpc("email_claim", { p_limit: Math.max(1, Math.min(40, room || 40)) });
  if (error) return json({ error: error.message }, 500);
  const rows = (batch as Row[]) || [];

  const { data: shopRow } = await db.from("app_settings").select("value").eq("key", "shop").maybeSingle();
  const shop = (shopRow?.value as Ctx["shop"]) || null;
  let sent = 0, failed = 0, deferred = 0;

  for (const row of rows) {
    const done = (patch: Record<string, unknown>) => db.from("email_outbox").update(patch).eq("id", row.id);
    try {
      // Newsletter list sync (not an email; doesn't count toward the daily cap).
      if (row.template === "_contact_sync") {
        const listId = Number(Deno.env.get("BREVO_LIST_ID") || 0);
        if (!listId) { await done({ status: "skipped", error: "BREVO_LIST_ID not set" }); continue; }
        if (row.data.subscribe) {
          await brevo("/contacts", { email: row.to_email, attributes: { FIRSTNAME: (row.to_name || "").split(" ")[0] }, listIds: [listId], updateEnabled: true }, key);
        } else {
          await brevo(`/contacts/lists/${listId}/contacts/remove`, { emails: [row.to_email] }, key).catch((e) => { if (!String(e).includes("404") && !String(e).includes("400")) throw e; });
        }
        await done({ status: "sent", sent_at: new Date().toISOString(), error: "" });
        continue;
      }
      if (sent >= room) { await done({ status: "queued", attempts: row.attempts - 1, send_after: new Date(Date.now() + 60 * 60 * 1000).toISOString(), error: "Daily limit reached; will retry" }); deferred++; continue; }

      let profile: Ctx["profile"] = null;
      if (row.user_id) {
        const { data: p } = await db.from("profiles").select("plan_until, pro_tvs, email_token, trial").eq("id", row.user_id).maybeSingle();
        profile = p as Ctx["profile"];
      }
      const out = render(row.template, { hostApp: HOST_APP, adminApp: ADMIN_APP, name: row.to_name, data: row.data || {}, profile, shop, kind: row.kind });
      if (!out) { await done({ status: "failed", error: `Unknown template ${row.template}` }); failed++; continue; }

      const headers: Record<string, string> = { "X-Karibu-Email": row.id };
      if (out.unsubscribe) { headers["List-Unsubscribe"] = `<${out.unsubscribe}>`; }
      const res = await brevo("/smtp/email", {
        sender: sender(), replyTo: { email: REPLY_TO, name: "Karibu TV" },
        to: [{ email: row.to_email, ...(row.to_name ? { name: row.to_name } : {}) }],
        subject: out.subject, htmlContent: out.html, textContent: out.text, headers, tags: [row.template],
      }, key);
      await done({ status: "sent", sent_at: new Date().toISOString(), provider_id: String(res.messageId || ""), error: "" });
      sent++;
    } catch (e) {
      const msg = String((e as Error).message || e).slice(0, 500);
      const final = row.attempts >= 3 || /Brevo 4(00|01|03)/.test(msg);
      await done(final ? { status: "failed", error: msg } : { status: "queued", error: msg, send_after: new Date(Date.now() + row.attempts * 5 * 60 * 1000).toISOString() });
      failed++;
    }
  }
  return json({ ok: true, claimed: rows.length, sent, failed, deferred, room });
});
