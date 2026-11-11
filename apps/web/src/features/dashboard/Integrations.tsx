import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { supabase, errorCode, errorMessage, functionError } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { timeAgo } from "@/lib/dates";
import type { Calendar, Property, Provider } from "@/lib/types";
import { Icon } from "@/components/Icons";
import { Button, ButtonLink, Card, ConfirmModal, EmptyState, ErrorBanner, Field, Input, Modal, PageHeader, ProTag, Tag } from "@/components/ui";
import { useData } from "./data";
import { PropertySwitcher } from "./shared/widgets";

export const PROVIDERS: { key: Provider; name: string; mark: ReactNode; bg: string; fg: string; help: string }[] = [
  { key: "airbnb", name: "Airbnb", mark: <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3c-1.5 0-2.3 1.3-3 2.8L4.6 15c-1.3 2.9.6 5.7 3.3 5.5 1.6-.1 2.8-1.3 4.1-2.8 1.3 1.5 2.5 2.7 4.1 2.8 2.7.2 4.6-2.6 3.3-5.5L15 5.8C14.3 4.3 13.5 3 12 3z" /><path d="M12 17.7c-1.8-2.1-3-4-3-5.4 0-1.6 1.3-2.6 3-2.6s3 1 3 2.6c0 1.4-1.2 3.3-3 5.4z" /></svg>, bg: "#FF5A5F", fg: "#fff",
    help: "Airbnb → Calendar → choose the listing → Availability → Connect calendars → Export calendar → copy the link." },
  { key: "booking", name: "Booking.com", mark: "B.", bg: "#003580", fg: "#fff",
    help: "Extranet → Rates & Availability → Sync calendars → Add calendar connection → Export → copy the link." },
  { key: "vrbo", name: "VRBO", mark: "Vrbo", bg: "#245ABC", fg: "#fff",
    help: "Vrbo → Calendar → Import and export → Export calendar → copy the link." },
  { key: "google", name: "Google Calendar", mark: "31", bg: "#ffffff", fg: "#1a73e8",
    help: "Google Calendar → Settings → your calendar → Integrate calendar → copy the “Secret address in iCal format”." },
  { key: "ical", name: "iCal Calendar", mark: <Icon name="calendar" size={24} />, bg: "#fde7ef", fg: "#b4235a",
    help: "Any calendar that gives an iCal (.ics) export link works: paste the full link that starts with https://." },
];
const PMS = "Hostaway, Guesty, Lodgify, Hospitable, Smoobu, OwnerRez, Beds24, Uplisting, Hostfully";
const providerOf = (k: Provider) => PROVIDERS.find((p) => p.key === k) || PROVIDERS[4];

function ConnectModal({ provider, property, open, onClose, onAdded }: { provider: Provider; property: Property; open: boolean; onClose: () => void; onAdded: () => void }) {
  const toast = useToast();
  const { openUpgrade } = useData();
  const pr = provider === "pms" ? { name: "your PMS", help: "In your PMS, open the listing and copy its iCal or calendar export link." } : providerOf(provider);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (open) { setUrl(""); setLabel(provider === "pms" ? "" : pr.name); setError(""); } }, [open, provider]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const u = url.trim().replace(/^webcal:\/\//i, "https://");
    if (!/^https?:\/\/\S+$/i.test(u)) { setError("Paste the full link that starts with https://"); return; }
    setSaving(true); setError("");
    try {
      const { data, error: err } = await supabase.from("calendars").insert({ property_id: property.id, provider, label: label.trim() || pr.name, url: u }).select("id").single();
      if (err) throw err;
      const { data: r, error: fnErr } = await supabase.functions.invoke("ical-sync", { body: { calendar_id: data.id } });
      if (fnErr) toast(`Saved. First sync failed: ${(await functionError(fnErr)).message}`, "error");
      else toast(r?.status === "ok" ? `Connected. ${r.event_count} booking${r.event_count === 1 ? "" : "s"} found.` : `Saved, but the calendar returned an error: ${r?.last_error}`, r?.status === "ok" ? "success" : "error");
      onAdded(); onClose();
    } catch (err) {
      if (errorCode(err) === "pro_required") { onClose(); openUpgrade(errorMessage(err)); }
      else setError(errorMessage(err));
    } finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={`Connect ${pr.name}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="connect-cal" loading={saving} icon="link">Connect</Button></>}>
      <form id="connect-cal" onSubmit={submit} className="space-y-4" noValidate>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <div className="rounded-md bg-surface-wash p-4 text-sm"><p className="font-semibold text-ink">Where's the link?</p><p className="mt-1 text-ink-muted">{pr.help}</p></div>
        <Field label="iCal link" hint="Usually ends in .ics">{(id, d) => <Input id={id} type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/calendar.ics" aria-describedby={d} />}</Field>
        <Field label="Name" optional hint="Shown on bookings, e.g. “From Airbnb”.">{(id, d) => <Input id={id} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder={provider === "pms" ? "Hostaway" : pr.name} aria-describedby={d} />}</Field>
        <p className="text-xs text-ink-muted">Connecting to: <b>{property.name}</b></p>
      </form>
    </Modal>
  );
}

function CalendarRow({ cal, onChanged }: { cal: Calendar; onChanged: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(false);
  const sync = async () => {
    setBusy(true);
    const { data: r, error } = await supabase.functions.invoke("ical-sync", { body: { calendar_id: cal.id } });
    if (error) toast((await functionError(error)).message, "error");
    else toast(r.status === "ok" ? `Synced. ${r.event_count} booking${r.event_count === 1 ? "" : "s"} found.` : r.last_error, r.status === "ok" ? "success" : "error");
    setBusy(false); onChanged();
  };
  const remove = async () => {
    setBusy(true);
    const { error } = await supabase.from("calendars").delete().eq("id", cal.id);
    if (error) toast(errorMessage(error), "error"); else toast("Calendar removed.");
    setBusy(false); setDel(false); onChanged();
  };
  return (
    <li className="flex flex-wrap items-center gap-2 border-t border-line pt-3 text-left text-sm">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{cal.label}</span>
        <span className={`block text-xs ${cal.last_status === "error" ? "text-danger" : "text-ink-muted"}`}>{cal.last_status === "error" ? cal.last_error : cal.last_synced ? `Synced ${timeAgo(cal.last_synced)} · ${cal.event_count} bookings` : "Waiting for the first sync"}</span>
      </span>
      <Button size="sm" variant="ghost" icon="refresh" loading={busy} onClick={sync} aria-label={`Sync ${cal.label} now`}>Sync</Button>
      <button onClick={() => setDel(true)} className="rounded-full p-2 text-danger hover:bg-danger/10" aria-label={`Remove ${cal.label}`}><Icon name="delete" size={16} /></button>
      <ConfirmModal open={del} onClose={() => setDel(false)} onConfirm={remove} loading={busy} danger confirmLabel="Remove" title={`Remove ${cal.label}?`} body="Future bookings from this calendar are removed. Bookings you added yourself stay." />
    </li>
  );
}

function PmsRequest() {
  const toast = useToast();
  const [pms, setPms] = useState("");
  const [details, setDetails] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!pms.trim()) { toast("Tell us which PMS you use.", "error"); return; }
    setBusy(true);
    const { error } = await supabase.from("pms_requests").insert({ pms: pms.trim(), details: details.trim() });
    setBusy(false);
    if (error) toast(errorMessage(error), "error"); else setSent(true);
  };
  if (sent) return <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-green"><Icon name="check" size={18} />Thanks! We'll let you know when {pms} is supported.</p>;
  return (
    <form onSubmit={send} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <Field label="Your PMS">{(id) => <Input id={id} value={pms} onChange={(e) => setPms(e.target.value)} maxLength={80} placeholder="e.g. Hostaway" />}</Field>
      <Field label="Anything else" optional>{(id) => <Input id={id} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} placeholder="How many listings" />}</Field>
      <Button type="submit" variant="secondary" loading={busy}>Send</Button>
    </form>
  );
}

function Board({ property }: { property: Property }) {
  const { plan } = useAuth();
  const { openUpgrade } = useData();
  const [cals, setCals] = useState<Calendar[] | null>(null);
  const [connect, setConnect] = useState<Provider | null>(null);
  const load = () => supabase.from("calendars").select("*").eq("property_id", property.id).order("created_at").then(({ data }) => setCals((data as Calendar[]) || []));
  useEffect(() => { load(); }, [property.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = (k: Provider) => (plan.pro ? setConnect(k) : openUpgrade("Calendar sync is a Pro feature. Your bookings from Airbnb, Booking.com and Vrbo appear by themselves."));

  return (
    <div className="space-y-6">
      {!plan.pro && <div className="flex items-center gap-2 rounded-md bg-mint-soft px-4 py-3 text-sm text-forest"><ProTag />Calendar sync is part of Pro. You can still add bookings by hand on the Bookings page.</div>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PROVIDERS.map((pr) => {
          const mine = (cals || []).filter((c) => c.provider === pr.key);
          const hasError = mine.some((c) => c.last_status === "error");
          return (
            <Card key={pr.key} className="flex flex-col items-center p-6 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-md border border-line font-display text-xl font-bold shadow-card" style={{ background: pr.bg, color: pr.fg }}>{pr.mark}</span>
              <h2 className="mt-4 font-display text-xl font-semibold text-ink">{pr.name}</h2>
              <p className={`mt-1 flex items-center gap-1.5 text-sm font-semibold ${mine.length ? (hasError ? "text-danger" : "text-green") : "text-danger"}`}>
                <Icon name={mine.length && !hasError ? "check" : "info"} size={16} />
                {mine.length ? (hasError ? "Sync error" : `Connected${mine.length > 1 ? ` (${mine.length})` : ""}`) : "Not connected"}
              </p>
              <Button className="mt-4" variant={mine.length ? "secondary" : "primary"} onClick={() => open(pr.key)}>{mine.length ? "Add another" : "Connect"}</Button>
              {mine.length > 0 && <ul className="mt-4 w-full space-y-3">{mine.map((c) => <CalendarRow key={c.id} cal={c} onChanged={load} />)}</ul>}
            </Card>
          );
        })}
      </div>

      <Card className="p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-mint-soft text-forest"><Icon name="building" /></span>
          <div>
            <h2 className="font-display text-xl font-semibold text-forest">PMS and channel managers</h2>
            <p className="mt-1 text-ink-muted">{PMS} and any other that gives an iCal (.ics) calendar link.</p>
          </div>
        </div>
        <p className="mt-4 text-ink-muted">In your PMS, open the listing and copy its iCal or calendar export link, then connect it here like any other calendar.</p>
        <Button className="mt-4" icon="link" onClick={() => open("pms")}>Connect an iCal link</Button>
        {(cals || []).filter((c) => c.provider === "pms").length > 0 && <ul className="mt-4 max-w-xl space-y-3">{(cals || []).filter((c) => c.provider === "pms").map((c) => <CalendarRow key={c.id} cal={c} onChanged={load} />)}</ul>}
        <div className="mt-6 border-t border-line pt-5">
          <p className="flex items-center gap-2 font-semibold text-ink">Direct PMS connection <Tag tone="warning">Coming soon</Tag></p>
          <p className="mt-1 text-sm text-ink-muted">Want guest names and bookings straight from your PMS, without calendar links? Tell us which one you use.</p>
          <PmsRequest />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-mint-soft text-forest"><Icon name="help" /></span>
          <div>
            <h2 className="font-display text-xl font-semibold text-forest">How calendar sync works</h2>
            <p className="mt-1 text-ink-muted">Every 30 minutes the server reads each link and updates the bookings.</p>
          </div>
        </div>
        <p className="mt-4 text-ink-muted">Calendars give dates only, never names: add the guest's first name under Bookings. Bookings you add yourself always win over the calendar. Dates you blocked yourself are not bookings and never show a guest. If a booking disappears from the calendar, it's marked cancelled here.</p>
      </Card>

      {connect && <ConnectModal provider={connect} property={property} open={!!connect} onClose={() => setConnect(null)} onAdded={load} />}
    </div>
  );
}

export default function Integrations() {
  const { selected } = useData();
  return (
    <div>
      <PageHeader title={<span className="flex items-center gap-3"><Icon name="link" size={28} />Integrations</span>} subtitle="Connect with popular booking platforms and calendars." actions={<PropertySwitcher />} />
      {selected ? <Board key={selected.id} property={selected} /> : <Card><EmptyState icon="building" title="Add a property first" action={<ButtonLink to="/app/properties">Add property</ButtonLink>} /></Card>}
    </div>
  );
}
