import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase, errorMessage } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { CONFIG } from "@/lib/config";
import { BRAND, waLink } from "@/lib/brand";
import { qrSvg } from "@/lib/qr";
import { timeAgo, tvStatus } from "@/lib/dates";
import type { Device } from "@/lib/types";
import { Icon } from "@/components/Icons";
import { Button, Card, ConfirmModal, EmptyState, Field, Input, Modal, PageHeader, Select, StatusDot } from "@/components/ui";
import { useData } from "./data";
import { PairTvForm } from "./shared/PairTvForm";

export function InstallSteps() {
  const where = CONFIG.app_short_url || CONFIG.apk_url;
  return (
    <ol className="space-y-3 text-sm">
      {[
        <>On the TV, open the Play Store and install <b>Downloader</b> (by AFTVnews).</>,
        <>In Downloader, type {where ? <b className="break-all">{where}</b> : "the Karibu TV app link"} and install the app. Allow installs from Downloader if the TV asks.</>,
        <>Open <b>Karibu TV</b>. Allow “Display over other apps” so it starts by itself when the TV turns on.</>,
        <>The TV shows a 6-character code. Type it below.</>,
      ].map((s, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mint font-display text-sm font-semibold text-on-mint">{i + 1}</span>
          <span className="pt-0.5">{s}</span>
        </li>
      ))}
    </ol>
  );
}

function Stat({ icon, value, label, tone }: { icon: string; value: number; label: string; tone: string }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-md ${tone}`}><Icon name={icon} size={26} /></span>
      <div><p className="font-display text-3xl font-semibold leading-none">{value}</p><p className="mt-1 text-sm text-ink-muted">{label}</p></div>
    </Card>
  );
}

function AppCard() {
  const toast = useToast();
  const [qr, setQr] = useState("");
  const short = CONFIG.app_short_url || CONFIG.apk_url;
  const link = CONFIG.apk_url || (short ? `https://${short.replace(/^https?:\/\//, "")}` : "");
  useEffect(() => { if (link) qrSvg(link).then(setQr); }, [link]);
  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-mint-soft text-forest"><Icon name="download" /></span>
        <div><h2 className="font-display text-xl font-semibold text-forest">Get the TV app · {CONFIG.app_version}</h2><p className="text-sm text-ink-muted">For Android TV and Google TV.</p></div>
      </div>
      <div className="mt-5 grid items-center gap-6 md:grid-cols-[1fr_auto]">
        <div>
          {short ? (
            <>
              <p className="text-sm font-semibold text-ink">On the TV, open the browser or the Downloader app and type</p>
              <p className="mt-2 break-all font-display text-3xl font-semibold text-green">{short.replace(/^https?:\/\//, "")}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a className="kb-btn kb-btn--primary kb-btn--md" href={link}><Icon name="download" size={18} />Download the app</a>
                <Button variant="secondary" icon="copy" onClick={() => navigator.clipboard.writeText(short).then(() => toast("Address copied."))}>Copy address</Button>
              </div>
            </>
          ) : (
            <p className="text-ink-muted">The TV app download link is being set up. <a className="font-semibold text-green underline" href={waLink(BRAND.supportWhatsApp, "Hi! Can you send me the Karibu TV app for my TV?")} target="_blank" rel="noreferrer">Ask us on WhatsApp</a> and we'll send it, or open <b>{window.location.host}/tv</b> in the TV's browser to try it now.</p>
          )}
          <p className="mt-3 text-sm text-ink-muted">Samsung or LG? Plug in any Google TV or Android TV stick and install it there.</p>
        </div>
        {qr && <div className="text-center"><div className="mx-auto h-36 w-36 rounded-md border border-line bg-white p-2 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} /><p className="mt-1 text-xs text-ink-muted">Scan with your phone</p></div>}
      </div>
    </Card>
  );
}

function DeviceRow({ d }: { d: Device }) {
  const { properties, reloadDevices } = useData();
  const toast = useToast();
  const [rename, setRename] = useState(false);
  const [unlink, setUnlink] = useState(false);
  const [name, setName] = useState(d.name);
  const [busy, setBusy] = useState(false);
  const status = tvStatus(d.last_seen || "");
  const act = async (fn: () => PromiseLike<{ error: unknown }>, msg: string) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) { toast(errorMessage(error), "error"); return false; }
    toast(msg); await reloadDevices(); return true;
  };
  return (
    <li className="grid gap-3 px-5 py-4 md:grid-cols-[1.3fr_1.2fr_1fr_auto] md:items-center">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-mint-soft text-forest"><Icon name="tv" /></span>
        <div className="min-w-0"><p className="truncate font-semibold">{d.name}</p><p className="text-xs text-ink-muted">{d.app_version ? `App ${d.app_version}` : "Browser / app"} · …{d.device_key.slice(-4)}</p></div>
      </div>
      <Select aria-label={`Property shown on ${d.name}`} value={d.property_id || ""} disabled={busy}
        onChange={(e) => act(() => supabase.rpc("device_update", { p_device: d.id, p_property: e.target.value }), "TV moved. It switches over in a few seconds.")}>
        {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </Select>
      <div>
        <StatusDot status={status} />
        <p className="text-xs text-ink-muted">Last opened {timeAgo(d.opened_at || "")} · seen {timeAgo(d.last_seen || "")}</p>
      </div>
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => { setName(d.name); setRename(true); }}>Rename</Button>
        <Button size="sm" variant="ghost" className="!text-danger" onClick={() => setUnlink(true)}>Unlink</Button>
      </div>
      <Modal open={rename} onClose={() => setRename(false)} title="Rename TV"
        footer={<><Button variant="ghost" onClick={() => setRename(false)}>Cancel</Button><Button loading={busy} disabled={!name.trim()} onClick={async () => { if (await act(() => supabase.rpc("device_update", { p_device: d.id, p_name: name.trim() }), "TV renamed.")) setRename(false); }}>Save</Button></>}>
        <Field label="Room name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />}</Field>
      </Modal>
      <ConfirmModal open={unlink} onClose={() => setUnlink(false)} loading={busy} danger confirmLabel="Unlink TV" title={`Unlink ${d.name}?`}
        body="The TV goes back to the pairing screen straight away. You can pair it again with a new code."
        onConfirm={async () => { if (await act(() => supabase.rpc("device_unlink", { p_device: d.id }), "TV unlinked.")) setUnlink(false); }} />
    </li>
  );
}

/** First moment worth sharing: the TV just came alive. */
export function Celebration({ open, onClose, tvName }: { open: boolean; onClose: () => void; tvName?: string }) {
  if (!open) return null;
  const colors = ["#f26b3a", "#f6b93b", "#004227", "#1f7a8c", "#c0ffa5"];
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="kb-live-title" onClick={onClose}>
      <div className="kb-pop relative w-full max-w-md overflow-hidden rounded-lg bg-surface text-center shadow-panel" onClick={(e) => e.stopPropagation()}>
        <div className="kb-confetti pointer-events-none absolute inset-0" aria-hidden>
          {Array.from({ length: 28 }, (_, i) => <span key={i} style={{ left: `${(i * 37) % 100}%`, background: colors[i % colors.length], animationDelay: `${(i % 7) * 0.12}s` }} />)}
        </div>
        <div className="kb-kikoi" />
        <div className="px-6 pb-7 pt-8">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sun text-on-sun"><Icon name="tv" size={30} /></span>
          <h2 id="kb-live-title" className="mt-5 font-display text-3xl font-semibold text-forest">Your TV is live!</h2>
          <p className="mt-2 text-ink-muted">{tvName ? `${tvName} now` : "It now"} says karibu to every guest. Look at the TV: your welcome screen is on.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <a href="/app/screens" className="kb-btn kb-btn--sun kb-btn--md">Make it look great</a>
            <Button variant="ghost" onClick={onClose}>Done</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Tvs() {
  const [params, setParams] = useSearchParams();
  const { devices, properties, selected, reloadDevices, openUpgrade } = useData();
  const { plan } = useAuth();
  const code = params.get("code") || "";
  const [pairing, setPairing] = useState(!!code || params.get("pair") === "1");
  const [live, setLive] = useState(false);
  const paired = devices.filter((d) => d.property_id);
  const atLimit = paired.length >= plan.maxTvs;
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const openedToday = paired.filter((d) => d.opened_at && Date.parse(d.opened_at) >= startOfDay.getTime()).length;
  const stale = paired.filter((d) => !d.opened_at || Date.now() - Date.parse(d.opened_at) > 3 * 86400000).length;

  const start = () => (atLimit
    ? openUpgrade(plan.pro ? `Your plan covers ${plan.maxTvs} TVs. Contact us to add more.` : "The Free plan includes 1 TV. Upgrade to Pro to pair more.")
    : setPairing(true));
  const close = () => { setPairing(false); setParams({}); };

  return (
    <div className="space-y-6">
      <PageHeader title={<span className="flex items-center gap-3"><Icon name="tv-signal" size={28} />TV Devices</span>} subtitle="Manage and monitor your connected TVs." actions={<Button icon="plus" onClick={start}>Pair new TV</Button>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon="tv-signal" value={paired.length} label="Connected TVs" tone="bg-mint-soft text-forest" />
        <Stat icon="tv" value={openedToday} label="Opened today" tone="bg-[#e3ecff] text-[#2550b8]" />
        <Stat icon="clock" value={stale} label="Not opened in 3+ days" tone="bg-[#f1ecff] text-[#6d28d9]" />
      </div>
      <Card className="overflow-hidden">
        {paired.length ? (
          <>
            <div className="hidden grid-cols-[1.3fr_1.2fr_1fr_auto] gap-3 border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted md:grid"><span>TV</span><span>Property</span><span>Status</span><span className="w-36" /></div>
            <ul className="divide-y divide-line">{paired.map((d) => <DeviceRow key={d.id} d={d} />)}</ul>
          </>
        ) : (
          <EmptyState icon="tv-signal" title="No TV paired yet" body={<>Install <b>Karibu TV</b> on the TV (Android TV or Google TV) and open it: it shows a 6-character code.</>} action={<Button onClick={start}>Pair a TV</Button>} />
        )}
      </Card>
      <AppCard />
      <p className="text-sm text-ink-muted">“Last opened” is when the welcome screen last started on that TV. To show another property on a TV, pick it in the Property column. {plan.maxTvs} TV{plan.maxTvs === 1 ? "" : "s"} on your plan.</p>

      <Modal open={pairing} onClose={close} title="Pair a TV" wide>
        <details className="mb-5 rounded-md bg-surface-wash p-4" open={!paired.length && !code}>
          <summary className="cursor-pointer text-sm font-semibold">How to install Karibu TV on the TV</summary>
          <div className="mt-4"><InstallSteps /></div>
        </details>
        {properties.length ? (
          <PairTvForm properties={properties} initialCode={code} defaultProperty={params.get("property") || selected?.id} onPaired={() => { reloadDevices(); close(); setLive(true); }} />
        ) : <EmptyState icon="building" title="Add a property first" />}
      </Modal>
      <Celebration open={live} onClose={() => setLive(false)} />
    </div>
  );
}
