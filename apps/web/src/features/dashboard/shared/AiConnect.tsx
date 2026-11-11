import { useEffect, useState, type FormEvent } from "react";
import { supabase, functionError } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import { Icon } from "@/components/Icons";
import { Button, Field, Input, Select, Spinner, Tag } from "@/components/ui";

export interface AiKeyInfo { provider: "anthropic" | "openai"; model: string; hint: string; verified_at: string | null }

const PROVIDERS = {
  anthropic: { label: "Claude (Anthropic)", keyUrl: "https://console.anthropic.com/settings/keys", prefix: "sk-ant-…", models: [
    { id: "claude-opus-5-5", label: "Claude Opus 5.5 (best results)" },
    { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (faster, cheaper)" },
    { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 (cheapest)" },
  ] },
  openai: { label: "ChatGPT (OpenAI)", keyUrl: "https://platform.openai.com/api-keys", prefix: "sk-…", models: [] as { id: string; label: string }[] },
};

export function useAiKey() {
  const [info, setInfo] = useState<AiKeyInfo | null | undefined>(undefined);
  const load = () => supabase.rpc("my_ai_key").then(({ data }) => setInfo((data as AiKeyInfo) || null), () => setInfo(null));
  useEffect(() => { load(); }, []);
  return { info, reload: load };
}

/** Connect the host's own Claude or OpenAI account. Their usage is billed to them, never to Karibu TV. */
export function AiConnect() {
  const toast = useToast();
  const { info, reload } = useAiKey();
  const [editing, setEditing] = useState(false);
  const [provider, setProvider] = useState<"anthropic" | "openai">("anthropic");
  const [model, setModel] = useState("claude-opus-5-5");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);

  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("ai-keys", { body });
    if (error) throw new Error((await functionError(error)).message);
    return data;
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = (await call({ action: "save", provider, key: key.trim(), model: provider === "anthropic" ? model : undefined })) as { model: string };
      setKey(""); setEditing(false); await reload();
      toast(`Connected. Using ${r.model}.`);
    } catch (err) { toast((err as Error).message, "error"); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await call({ action: "delete" }); await reload(); toast("Disconnected. Your key was deleted."); }
    catch (err) { toast((err as Error).message, "error"); } finally { setBusy(false); }
  };

  if (info === undefined) return <Spinner />;
  if (info && !editing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-mint text-maroon"><Icon name="sparkle" size={18} /></span>
          <div>
            <p className="flex items-center gap-2 font-semibold">{PROVIDERS[info.provider].label}<Tag>Connected</Tag></p>
            <p className="text-sm text-ink-muted">Key ending …{info.hint} · {info.model}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => { setProvider(info.provider); setModel(info.model); setEditing(true); }}>Change</Button>
          <Button size="sm" variant="ghost" loading={busy} onClick={remove}>Disconnect</Button>
        </div>
      </div>
    );
  }
  const p = PROVIDERS[provider];
  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="AI provider">
        {(Object.keys(PROVIDERS) as ("anthropic" | "openai")[]).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={provider === k} onClick={() => { setProvider(k); if (k === "anthropic") setModel("claude-opus-5-5"); }}
            className={`rounded-md border-2 p-3 text-left text-sm font-semibold transition-colors ${provider === k ? "border-maroon bg-mint-soft" : "border-line hover:border-line-strong"}`}>
            {PROVIDERS[k].label}
          </button>
        ))}
      </div>
      {provider === "anthropic" && (
        <Field label="Model">{(id) => <Select id={id} value={model} onChange={(e) => setModel(e.target.value)}>{p.models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</Select>}</Field>
      )}
      <Field label="API key" hint={<>Create one at <a className="font-semibold text-maroon underline" href={p.keyUrl} target="_blank" rel="noreferrer">{p.keyUrl.replace("https://", "")}</a>. It's checked, encrypted and never shown again.</>}>
        {(id, d) => <Input id={id} type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={p.prefix} autoComplete="off" spellCheck={false} aria-describedby={d} />}
      </Field>
      <p className="rounded-md bg-surface-wash p-3 text-xs text-ink-muted">
        AI features run on your own account and are billed by {provider === "anthropic" ? "Anthropic" : "OpenAI"} at their API prices. You can set a monthly spending limit in their console.
        A Claude Pro or ChatGPT Plus subscription doesn't include API use, and neither company lets other apps sign in with those subscriptions.
      </p>
      <div className="flex gap-2">
        <Button type="submit" loading={busy} disabled={key.trim().length < 20}>Connect and test</Button>
        {info && <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>}
      </div>
    </form>
  );
}
