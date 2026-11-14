// Paystack checkout for Pro (pay ahead) and the shop. Secret: PAYSTACK_SECRET_KEY (sk_live_... or sk_test_...).
// Webhook URL to set in Paystack (Settings > API Keys & Webhooks): https://<project>.supabase.co/functions/v1/paystack
//
// Actions (POST JSON):
//   { action: "plan", tvs, months }    signed-in host -> Paystack checkout link for Pro
//   { action: "order", number, token } shop buyer     -> Paystack checkout link for that order
//   { action: "verify", reference }    return page    -> asks Paystack, settles if paid
// Paystack's webhook (x-paystack-signature) settles payments even if the buyer closes the tab.
// Nothing counts as paid until Paystack itself says the charge succeeded for the exact amount we set.
import { admin, cors, json } from "../_shared/supabase.ts";

const HOST_APP = Deno.env.get("HOST_APP_URL") || "https://tv.mrserengeti.com";
const PS = "https://api.paystack.co";
const secret = () => (Deno.env.get("PAYSTACK_SECRET_KEY") || "").trim();
// With a test key, only test accounts (@example.com) can pay, so nobody gets Pro or an order with a fake card.
const testMode = () => secret().startsWith("sk_test_");
const testOnly = (email: string) => testMode() && !/@example\.com$/i.test(email.trim());
const TEST_MSG = "Online payment is being tested. WhatsApp us and we'll switch you on.";

async function paystack(path: string, body?: unknown) {
  const r = await fetch(`${PS}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${secret()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.status === false) throw new Error(d.message || `Paystack ${r.status}`);
  return d.data;
}

async function hmac512(text: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const sameText = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
};

// Ask Paystack about a reference; settle it in the database if it succeeded.
async function settle(reference: string) {
  const d = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`);
  if (d?.status !== "success") return { ok: false, status: String(d?.status || "unknown") };
  const a = d.authorization || {};
  const raw = {
    id: d.id, reference: d.reference, amount: d.amount, currency: d.currency, channel: d.channel, paid_at: d.paid_at,
    authorization: { channel: a.channel, card_type: a.card_type, last4: a.last4, bank: a.bank, brand: a.brand },
  };
  const { data, error } = await admin().rpc("paystack_settle", {
    p_ref: reference, p_amount_minor: d.amount, p_currency: d.currency, p_raw: raw, p_order: d.metadata?.order_id || null,
  });
  if (error) throw new Error(error.message);
  return { status: "success", ...(data as Record<string, unknown>) };
}

const friendly = (e: unknown) => String((e as Error)?.message || e).replace(/^.*?:\s*(?=[A-Z])/, "").slice(0, 200);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!secret()) return json({ error: "Online payment isn't switched on yet. WhatsApp us and we'll help." }, 503);
  const raw = await req.text();

  // Paystack webhook.
  const sig = req.headers.get("x-paystack-signature");
  if (sig) {
    if (!sameText(await hmac512(raw), sig)) return json({ error: "Bad signature" }, 401);
    let evt: { event?: string; data?: { reference?: string } } = {};
    try { evt = JSON.parse(raw); } catch { return json({ error: "Bad body" }, 400); }
    if (evt.event === "charge.success" && evt.data?.reference) {
      try { await settle(evt.data.reference); } catch (e) { console.error("settle failed", evt.data.reference, e); return json({ error: "retry" }, 500); }
    }
    return json({ ok: true });
  }

  let body: Record<string, unknown> = {};
  try { body = JSON.parse(raw || "{}"); } catch { return json({ error: "Bad request" }, 400); }
  const db = admin();

  try {
    if (body.action === "plan") {
      const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      const { data: u } = await db.auth.getUser(token);
      const user = u.user;
      if (!user?.email) return json({ error: "Please sign in again." }, 401);
      if (testOnly(user.email)) return json({ error: TEST_MSG }, 403);
      const tvs = Math.floor(Number(body.tvs)), months = Math.floor(Number(body.months));
      const { data: pay, error } = await db.rpc("paystack_plan_create", { p_user: user.id, p_tvs: tvs, p_months: months });
      if (error) return json({ error: friendly(error.message) }, 400);
      const p = pay as { id: string; amount: number; reference: string };
      const init = await paystack("/transaction/initialize", {
        email: user.email, amount: Math.round(Number(p.amount) * 100), currency: "KES", reference: p.reference,
        callback_url: `${HOST_APP}/app/billing`,
        metadata: {
          kind: "plan", payment_id: p.id, user_id: user.id, tvs, months,
          custom_fields: [{ display_name: "Plan", variable_name: "plan", value: `Karibu TV Pro, ${tvs} TV${tvs > 1 ? "s" : ""}, ${months} month${months > 1 ? "s" : ""}` }],
        },
      });
      return json({ url: init.authorization_url, reference: p.reference, amount: p.amount });
    }

    if (body.action === "order") {
      const number = Math.floor(Number(body.number));
      const tok = String(body.token || "");
      const { data, error } = await db.rpc("paystack_order_start", { p_number: number, p_token: tok });
      if (error) return json({ error: friendly(error.message) }, 400);
      const o = data as { id: string; number: number; reference: string; amount_kes: number; email: string; name: string };
      if (testOnly(o.email)) return json({ error: TEST_MSG }, 403);
      const init = await paystack("/transaction/initialize", {
        email: o.email, amount: o.amount_kes * 100, currency: "KES", reference: o.reference,
        callback_url: `${HOST_APP}/shop/order/${o.number}?t=${encodeURIComponent(tok)}`,
        metadata: {
          kind: "order", order_id: o.id, order_number: o.number,
          custom_fields: [{ display_name: "Order", variable_name: "order", value: `Karibu TV Shop #${o.number}` }],
        },
      });
      return json({ url: init.authorization_url, reference: o.reference });
    }

    if (body.action === "verify") {
      const ref = String(body.reference || "");
      if (!/^KTV[PO][0-9A-F]{16}$/.test(ref)) return json({ error: "Unknown payment" }, 400);
      return json(await settle(ref));
    }
  } catch (e) {
    console.error(e);
    return json({ error: `Payment couldn't start: ${friendly(e)}` }, 502);
  }
  return json({ error: "Unknown action" }, 400);
});
