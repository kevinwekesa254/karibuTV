// One structured-JSON call to the host's own AI provider (their key, their bill).
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";

export type Provider = "anthropic" | "openai";
export type Json = Record<string, unknown>;

export const ANTHROPIC_MODELS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"];
const OPENAI_PREFERRED = ["gpt-5-mini", "gpt-5", "gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini", "gpt-4o"];

export class AiError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

/** Check the key works and pick a model. Returns the model to store. */
export async function verifyKey(provider: Provider, apiKey: string, wanted?: string): Promise<string> {
  if (provider === "anthropic") {
    if (!/^sk-ant-[\w-]{20,}$/.test(apiKey)) throw new AiError("That doesn't look like a Claude API key (it starts with sk-ant-).", 400);
    try {
      const client = new Anthropic({ apiKey, maxRetries: 0 });
      await client.models.list();
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new AiError("Claude rejected that key. Check it in the Claude Console.", 400);
      throw new AiError("Couldn't reach Claude to check the key. Try again.", 502);
    }
    return ANTHROPIC_MODELS.includes(wanted || "") ? wanted! : ANTHROPIC_MODELS[0];
  }
  if (!/^sk-[\w-]{20,}$/.test(apiKey)) throw new AiError("That doesn't look like an OpenAI API key (it starts with sk-).", 400);
  const res = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${apiKey}` } });
  if (res.status === 401 || res.status === 403) throw new AiError("OpenAI rejected that key. Check it at platform.openai.com.", 400);
  if (!res.ok) throw new AiError("Couldn't reach OpenAI to check the key. Try again.", 502);
  const ids: string[] = ((await res.json())?.data || []).map((m: { id: string }) => m.id);
  if (wanted && ids.includes(wanted)) return wanted;
  const pick = OPENAI_PREFERRED.find((m) => ids.includes(m)) || ids.find((m) => /^gpt-/.test(m));
  if (!pick) throw new AiError("That OpenAI key has no chat models available.", 400);
  return pick;
}

/** Ask for JSON matching `schema`. Throws AiError with a host-friendly message. */
export async function askJson(provider: Provider, apiKey: string, model: string, system: string, prompt: string, schema: Json): Promise<Json> {
  if (provider === "anthropic") {
    const client = new Anthropic({ apiKey });
    const fallbacks = model === "claude-opus-5-5" || model === "claude-sonnet-5-5";
    try {
      const res = await client.beta.messages.create({
        model,
        max_tokens: 4000,
        ...(fallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
        output_config: { effort: "low", format: { type: "json_schema", schema } },
        system,
        messages: [{ role: "user", content: prompt }],
      });
      if (res.stop_reason === "refusal") throw new AiError("The assistant couldn't help with this one.", 422);
      return JSON.parse(res.content.map((b) => (b.type === "text" ? b.text : "")).join(""));
    } catch (e) {
      if (e instanceof AiError) throw e;
      if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new AiError("Your Claude key stopped working. Update it in Settings > AI.", 401);
      if (e instanceof Anthropic.RateLimitError) throw new AiError("Your Claude account hit its rate limit. Try again in a minute.", 429);
      if (e instanceof Anthropic.BadRequestError) throw new AiError("Claude couldn't run this request. Check your account has credit.", 400);
      if (e instanceof Anthropic.APIError) throw new AiError("Claude had a problem. Try again shortly.", 502);
      throw e;
    }
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
      response_format: { type: "json_schema", json_schema: { name: "result", strict: true, schema } },
    }),
  });
  if (res.status === 401 || res.status === 403) throw new AiError("Your OpenAI key stopped working. Update it in Settings > AI.", 401);
  if (res.status === 429) throw new AiError("Your OpenAI account hit a limit or has no credit left.", 429);
  if (!res.ok) throw new AiError("OpenAI had a problem. Try again shortly.", 502);
  const msg = (await res.json())?.choices?.[0]?.message;
  if (msg?.refusal) throw new AiError("The assistant couldn't help with this one.", 422);
  return JSON.parse(msg?.content || "{}");
}
