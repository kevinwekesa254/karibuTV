// AI for hosts (Claude). Host JWT required; the host must own the property.
//   POST { property_id, mode: "picks" }    -> suggested local picks + extras for the area
//   POST { property_id, mode: "insights" } -> guest-guide stats (last 30 days) + 3 tips from Claude
// Secret: ANTHROPIC_API_KEY (supabase secrets set ANTHROPIC_API_KEY=...). 20 AI calls per host per day.
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { admin, caller, cors, json } from "../_shared/supabase.ts";

const MODEL = "claude-opus-5-5";
const DAILY_CAP = 20;

const PICKS_SCHEMA = {
  type: "object", additionalProperties: false, required: ["picks", "extras"],
  properties: {
    picks: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "note"],
      properties: { title: { type: "string" }, note: { type: "string" } } } },
    extras: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "price"],
      properties: { title: { type: "string" }, price: { type: "string" } } } },
  },
};
const TIPS_SCHEMA = {
  type: "object", additionalProperties: false, required: ["tips"],
  properties: { tips: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "detail"],
    properties: { title: { type: "string" }, detail: { type: "string" } } } } },
};

const SYSTEM = `You help short-term rental hosts in East Africa (Kenya, Tanzania, Uganda, Rwanda and neighbours) make guests' stays better.
Be concrete and local. Write in plain English for a busy host. Never invent prices you can't stand behind: give a sensible local range in the local currency, or leave price empty.
Only suggest real, well-known places you are confident exist near the given area. If unsure about the area, suggest kinds of places instead (for example "Nearest supermarket").`;

type Json = Record<string, unknown>;

async function ask(client: Anthropic, prompt: string, schema: Json) {
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema } },
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });
  if (res.stop_reason === "refusal") throw new Error("The assistant couldn't help with this one.");
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return JSON.parse(text) as Json;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { userId } = await caller(req);
    if (!userId) return json({ error: "Sign in first." }, 401);
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return json({ error: "AI isn't switched on yet. Ask the Karibu TV team." }, 503);

    const { property_id, mode } = await req.json().catch(() => ({}));
    if (!property_id || !["picks", "insights"].includes(mode)) return json({ error: "Bad request." }, 400);

    const db = admin();
    const { data: p } = await db.from("properties").select("id, owner_id, name, area, tagline, amenities, picks, extras").eq("id", property_id).single();
    if (!p || p.owner_id !== userId) return json({ error: "Property not found." }, 404);

    const since = new Date(Date.now() - 864e5).toISOString();
    const { count } = await db.from("ai_usage").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since);
    if ((count || 0) >= DAILY_CAP) return json({ error: "You've used today's AI suggestions. Try again tomorrow." }, 429);
    await db.from("ai_usage").insert({ user_id: userId, mode });

    const client = new Anthropic({ apiKey: key });
    const place = `${p.name} in ${p.area || "an unspecified area"}${p.tagline ? ` (${p.tagline})` : ""}`;

    if (mode === "picks") {
      const have = [...(p.picks || []).map((x: Json) => x.title), ...(p.extras || []).map((x: Json) => x.title)].join(", ") || "none yet";
      const out = await ask(client, `Property: ${place}.
Already listed: ${have}.
Suggest up to 5 local picks (title max 40 characters, note max 50 characters with what it is and rough travel time) that guests would love, and up to 4 extras the host could arrange for a fee (airport transfer, day trips, meals...). Don't repeat what's already listed.`, PICKS_SCHEMA);
      return json(out);
    }

    // insights
    const from = new Date(Date.now() - 30 * 864e5).toISOString();
    const { data: ev } = await db.from("guide_events").select("kind, item, created_at").eq("property_id", property_id).gte("created_at", from).limit(5000);
    const events = (ev || []) as { kind: string; item: string; created_at: string }[];
    const tally = (kind: string) => {
      const m = new Map<string, number>();
      for (const e of events) if (e.kind === kind && e.item) m.set(e.item, (m.get(e.item) || 0) + 1);
      return [...m].sort((a, b) => b[1] - a[1]).map(([item, n]) => ({ item, n }));
    };
    const hours = new Array(24).fill(0);
    for (const e of events) if (e.kind === "view") hours[(new Date(e.created_at).getUTCHours() + 3) % 24]++;
    const stats = {
      scans: events.filter((e) => e.kind === "view").length,
      picks: tally("pick"), extras: tally("extra"),
      reviews: events.filter((e) => e.kind === "review").length,
      messages: events.filter((e) => e.kind === "message").length,
      busiest_hour: hours.some(Boolean) ? hours.indexOf(Math.max(...hours)) : null,
    };
    const listed = { picks: (p.picks || []).map((x: Json) => x.title), extras: (p.extras || []).map((x: Json) => x.title) };
    const out = await ask(client, `Property: ${place}.
Guest guide activity over the last 30 days (from the QR code on the TV): ${JSON.stringify(stats)}.
Currently listed: ${JSON.stringify(listed)}.
Give exactly 3 short, specific tips (title max 60 characters, detail max 200 characters) to get more value from the guide: what to promote, drop, reorder, price or add. If there is little or no activity, say how to get guests to scan it.`, TIPS_SCHEMA);
    return json({ stats, ...out });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: "The AI is busy. Try again in a minute." }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: "The AI service had a problem. Try again shortly." }, 502);
    return json({ error: (e as Error).message || "Something went wrong." }, 500);
  }
});
