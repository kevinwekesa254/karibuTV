import { useEffect, useMemo, useState } from "react";
import { supabase, functionError } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import type { Extra, Pick, Property } from "@/lib/types";
import { Icon } from "@/components/Icons";
import { Button, ButtonLink, Card, EmptyState, PageHeader, Spinner } from "@/components/ui";
import { useData } from "./data";
import { useSaveProperty } from "./shared/editing";
import { PropertySwitcher } from "./shared/widgets";
import { useAiKey } from "./shared/AiConnect";

interface Ev { kind: "view" | "pick" | "extra" | "review" | "message"; item: string; created_at: string }
interface Tip { title: string; detail: string }

const RANGES = [{ days: 7, label: "7 days" }, { days: 30, label: "30 days" }, { days: 90, label: "90 days" }];

function rank(events: Ev[], kind: Ev["kind"]) {
  const m = new Map<string, number>();
  for (const e of events) if (e.kind === kind && e.item) m.set(e.item, (m.get(e.item) || 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
}

function Ranked({ title, icon, rows, empty }: { title: string; icon: string; rows: [string, number][]; empty: string }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-forest"><Icon name={icon} size={18} className="text-maroon" />{title}</h2>
      {rows.length ? (
        <ol className="mt-4 space-y-3">
          {rows.slice(0, 6).map(([item, n], i) => (
            <li key={item} className="flex items-center gap-3">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-sm font-semibold ${i === 0 ? "bg-maroon text-white" : "bg-mint-soft text-maroon"}`}>{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{item}</span>
              <span className="font-display text-lg font-semibold tabular-nums">{n}</span>
            </li>
          ))}
        </ol>
      ) : <p className="mt-4 text-sm text-ink-muted">{empty}</p>}
    </Card>
  );
}

function InsightsBody({ property }: { property: Property }) {
  const toast = useToast();
  const { save } = useSaveProperty(property);
  const [days, setDays] = useState(30);
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [tips, setTips] = useState<Tip[] | null>(null);
  const [ideas, setIdeas] = useState<{ picks: Pick[]; extras: Extra[] } | null>(null);
  const [busy, setBusy] = useState("");
  const { info: aiKey } = useAiKey();

  useEffect(() => {
    setEvents(null);
    supabase.from("guide_events").select("kind, item, created_at").eq("property_id", property.id)
      .gte("created_at", new Date(Date.now() - days * 864e5).toISOString()).order("created_at", { ascending: false }).limit(5000)
      .then(({ data }) => setEvents((data as Ev[]) || []));
  }, [property.id, days]);

  const s = useMemo(() => {
    const ev = events || [];
    const hours = new Array(24).fill(0);
    for (const e of ev) if (e.kind === "view") hours[new Date(e.created_at).getHours()]++;
    const peak = hours.some(Boolean) ? hours.indexOf(Math.max(...hours)) : null;
    return {
      scans: ev.filter((e) => e.kind === "view").length,
      picks: rank(ev, "pick"), extras: rank(ev, "extra"),
      reviews: ev.filter((e) => e.kind === "review").length,
      messages: ev.filter((e) => e.kind === "message").length,
      peak,
    };
  }, [events]);

  const ai = async (mode: "insights" | "picks") => {
    setBusy(mode);
    try {
      const { data, error } = await supabase.functions.invoke("ai-insights", { body: { property_id: property.id, mode } });
      if (error) throw new Error((await functionError(error)).message);
      if (mode === "insights") setTips((data as { tips: Tip[] }).tips || []);
      else setIdeas({ picks: ((data as { picks: Pick[] }).picks || []).map((p) => ({ ...p, url: "" })), extras: (data as { extras: Extra[] }).extras || [] });
    } catch (e) { toast((e as Error).message || "The AI didn't answer. Try again.", "error"); }
    finally { setBusy(""); }
  };

  const addPick = async (p: Pick) => {
    if (property.picks.length >= 6) { toast("You already have 6 picks. Remove one on Guide & Extras first.", "error"); return; }
    const ok = await save({ picks: [...property.picks, p] }, `Added “${p.title}”.`);
    if (ok) setIdeas((x) => x && { ...x, picks: x.picks.filter((y) => y.title !== p.title) });
  };
  const addExtra = async (x: Extra) => {
    if (property.extras.length >= 6) { toast("You already have 6 extras. Remove one on Guide & Extras first.", "error"); return; }
    const ok = await save({ extras: [...property.extras, x] }, `Added “${x.title}”.`);
    if (ok) setIdeas((i) => i && { ...i, extras: i.extras.filter((y) => y.title !== x.title) });
  };

  const fmtHour = (h: number) => `${String(h).padStart(2, "0")}:00`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-line bg-surface p-1" role="radiogroup" aria-label="Period">
          {RANGES.map((r) => (
            <button key={r.days} role="radio" aria-checked={days === r.days} onClick={() => setDays(r.days)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${days === r.days ? "bg-ink text-on-ink" : "hover:bg-surface-wash"}`}>{r.label}</button>
          ))}
        </div>
        <p className="text-sm text-ink-muted">From guests scanning the guide QR code on your TV.</p>
      </div>

      {events === null ? <Card className="flex justify-center p-10"><Spinner /></Card> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Guide opened", value: s.scans, icon: "qr" },
              { label: "Extras requested", value: s.extras.reduce((a, [, n]) => a + n, 0), icon: "sparkle" },
              { label: "Review taps", value: s.reviews, icon: "star" },
              { label: "Busiest time", value: s.peak === null ? "No data" : fmtHour(s.peak), icon: "clock" },
            ].map((x) => (
              <Card key={x.label} className="p-5">
                <Icon name={x.icon} size={20} className="text-maroon" />
                <p className="mt-3 font-display text-3xl font-semibold tabular-nums leading-none">{x.value}</p>
                <p className="mt-1 text-sm text-ink-muted">{x.label}</p>
              </Card>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Ranked title="Most visited picks" icon="pin" rows={s.picks} empty="No taps on your picks yet. Add picks on Guide & Extras and they'll show here." />
            <Ranked title="Most requested extras" icon="sparkle" rows={s.extras} empty="No extra requests yet." />
          </div>
        </>
      )}

      {aiKey === null ? (
        <Card className="overflow-hidden">
          <div className="kb-kikoi kb-kikoi--thin" />
          <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
            <div className="max-w-xl">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-forest"><Icon name="sparkle" className="text-maroon" />Get AI tips and suggestions</h2>
              <p className="mt-1 text-sm text-ink-muted">Connect your own Claude or ChatGPT account in Settings. It runs on your account, so you control the cost.</p>
            </div>
            <ButtonLink to="/app/settings" icon="sparkle">Connect AI</ButtonLink>
          </div>
        </Card>
      ) : (
      <Card className="overflow-hidden">
        <div className="kb-kikoi kb-kikoi--thin" />
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-2">
          <div>
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-forest"><Icon name="sparkle" className="text-maroon" />AI tips for this property</h2>
            <p className="mt-1 text-sm text-ink-muted">Your AI ({aiKey?.provider === "openai" ? "ChatGPT" : "Claude"}) reads your guide activity and suggests what to promote, drop or add.</p>
            <Button className="mt-4" icon="sparkle" loading={busy === "insights"} onClick={() => ai("insights")}>{tips ? "Refresh tips" : "Get tips"}</Button>
            {tips && (
              <ol className="mt-5 space-y-3">
                {tips.map((t, i) => (
                  <li key={i} className="rounded-md bg-mint-soft p-4"><p className="font-semibold text-forest">{t.title}</p><p className="mt-1 text-sm">{t.detail}</p></li>
                ))}
              </ol>
            )}
          </div>
          <div>
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-forest"><Icon name="pin" className="text-maroon" />Suggested picks and extras</h2>
            <p className="mt-1 text-sm text-ink-muted">Ideas for {property.area || property.name}. Check each one before adding it.</p>
            <Button className="mt-4" variant="secondary" icon="sparkle" loading={busy === "picks"} onClick={() => ai("picks")}>{ideas ? "More ideas" : "Suggest ideas"}</Button>
            {ideas && (
              <ul className="mt-5 space-y-2">
                {ideas.picks.map((p) => (
                  <li key={`p-${p.title}`} className="flex items-center gap-3 rounded-md border border-line p-3">
                    <Icon name="pin" size={16} className="text-maroon" />
                    <span className="min-w-0 flex-1"><span className="block font-semibold">{p.title}</span><span className="block truncate text-xs text-ink-muted">{p.note}</span></span>
                    <Button size="sm" variant="ghost" icon="plus" onClick={() => addPick(p)}>Add</Button>
                  </li>
                ))}
                {ideas.extras.map((x) => (
                  <li key={`x-${x.title}`} className="flex items-center gap-3 rounded-md border border-line p-3">
                    <Icon name="sparkle" size={16} className="text-maroon" />
                    <span className="min-w-0 flex-1"><span className="block font-semibold">{x.title}</span><span className="block text-xs text-ink-muted">{x.price || "Set your price"}</span></span>
                    <Button size="sm" variant="ghost" icon="plus" onClick={() => addExtra(x)}>Add</Button>
                  </li>
                ))}
                {!ideas.picks.length && !ideas.extras.length && <li className="text-sm text-ink-muted">All added.</li>}
              </ul>
            )}
          </div>
        </div>
      </Card>
      )}
    </div>
  );
}

export default function Insights() {
  const { selected } = useData();
  return (
    <div>
      <PageHeader title={<span className="flex items-center gap-3"><Icon name="chart" size={28} />Insights</span>}
        subtitle="What guests open, tap and ask for, with AI suggestions." actions={<PropertySwitcher />} />
      {selected ? <InsightsBody key={selected.id} property={selected} /> : <Card><EmptyState icon="building" title="Add a property first" action={<ButtonLink to="/app/properties">Add property</ButtonLink>} /></Card>}
    </div>
  );
}
