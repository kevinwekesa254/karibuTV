// Super admin. Access needs profiles.role = 'admin' AND a two-step-verified session (aal2);
// the database enforces both (public.admin_ok()), this screen only guides the admin there.
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { supabase, errorMessage } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { timeAgo } from "@/lib/dates";
import { countryOf } from "@/lib/countries";
import { formatMoney, quote } from "@/lib/pricing";
import { Icon } from "@/components/Icons";
import { Flag } from "@/components/PhoneInput";
import { Logo } from "@/components/Logo";
import { Button, Card, Field, Input, Modal, PageHeader, PageLoader, Select, Tag, Textarea } from "@/components/ui";

interface Host {
  id: string; name: string; email: string; whatsapp: string; country: string; role: string; business_name: string;
  plan: "free" | "pro"; plan_until: string | null; pro_tvs: number; trial: boolean; created_at: string;
  properties: number; tvs: number; tvs_online: number;
}
type Stats = Record<"hosts" | "hosts_7d" | "pro" | "trials" | "properties" | "tvs" | "tvs_online" | "leads_7d" | "guide_scans_7d", number>;

const isPro = (h: Host) => h.plan === "pro" && !!h.plan_until && Date.parse(h.plan_until) > Date.now();

/** Two-step gate: admins must verify with their authenticator app before any admin data loads. */
function useAdminGate() {
  const { profile, ready } = useAuth();
  const [state, setState] = useState<"loading" | "ok" | "need-code" | "need-setup" | "denied">("loading");
  const check = async () => {
    if (!profile) return;
    if (profile.role !== "admin") { setState("denied"); return; }
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data?.currentLevel === "aal2") setState("ok");
    else if (data?.nextLevel === "aal2") setState("need-code");
    else setState("need-setup");
  };
  useEffect(() => { if (ready) check(); }, [ready, profile]); // eslint-disable-line react-hooks/exhaustive-deps
  return { state, recheck: check };
}

function CodeGate({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const { data: f } = await supabase.auth.mfa.listFactors();
      const factor = f?.totp.find((x) => x.status === "verified");
      if (!factor) throw new Error("No authenticator app found.");
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.replace(/\s/g, "") });
      if (error) throw error;
      onDone();
    } catch (e2) { setErr(errorMessage(e2)); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-ink-muted">Enter the 6-digit code from your authenticator app to open the admin area.</p>
      {err && <p className="kb-error">{err}</p>}
      <Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7} autoFocus aria-label="6-digit code" className="text-center font-display text-2xl tracking-[0.4em]" />
      <Button type="submit" className="w-full" loading={busy} disabled={code.replace(/\s/g, "").length !== 6}>Verify</Button>
    </form>
  );
}

function GateScreen({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-surface-wash p-4">
      <Card className="w-full max-w-md overflow-hidden"><div className="kb-kikoi" /><div className="p-6 sm:p-8"><Logo to="/app" /><h1 className="mt-6 font-display text-2xl font-semibold text-forest">{title}</h1><div className="mt-4">{children}</div></div></Card>
    </div>
  );
}

// ---------------------------------------------------------------- pages
function Overview() {
  const [s, setS] = useState<Stats | null>(null);
  const [hosts, setHosts] = useState<Host[]>([]);
  useEffect(() => {
    supabase.rpc("admin_stats").then(({ data }) => setS(data as Stats));
    supabase.rpc("admin_hosts").then(({ data }) => setHosts(((data as Host[]) || []).slice(0, 6)));
  }, []);
  if (!s) return <PageLoader />;
  const cards = [
    { label: "Hosts", value: s.hosts, sub: `+${s.hosts_7d} this week`, icon: "users" },
    { label: "Paying Pro", value: s.pro, sub: `${s.trials} on trial`, icon: "crown" },
    { label: "TVs paired", value: s.tvs, sub: `${s.tvs_online} online now`, icon: "tv-signal" },
    { label: "Properties", value: s.properties, sub: `${s.guide_scans_7d} guide scans this week`, icon: "building" },
  ];
  return (
    <div className="space-y-6">
      <PageHeader title="Overview" subtitle="Karibu TV across East Africa, right now." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-5">
            <Icon name={c.icon} size={20} className="text-maroon" />
            <p className="mt-3 font-display text-4xl font-semibold tabular-nums leading-none">{c.value}</p>
            <p className="mt-1 font-semibold">{c.label}</p><p className="text-sm text-ink-muted">{c.sub}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between"><h2 className="font-display text-lg font-semibold text-forest">Newest hosts</h2><Link to="/admin/hosts" className="text-sm font-semibold text-maroon underline">All hosts</Link></div>
          <ul className="mt-4 divide-y divide-line">
            {hosts.map((h) => (
              <li key={h.id} className="flex items-center gap-3 py-3">
                <Flag code={countryOf(h.country)?.flag || ""} />
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{h.name || h.email}</span><span className="block truncate text-xs text-ink-muted">{h.email} · joined {timeAgo(h.created_at)}</span></span>
                {isPro(h) ? <Tag tone="ink">{h.trial ? "TRIAL" : "PRO"}</Tag> : <Tag>FREE</Tag>}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold text-forest">This week</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-ink-muted">New leads</dt><dd className="font-semibold">{s.leads_7d}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-muted">New hosts</dt><dd className="font-semibold">{s.hosts_7d}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-muted">Guide scans</dt><dd className="font-semibold">{s.guide_scans_7d}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-muted">Revenue</dt><dd className="font-semibold">Starts with payments</dd></div>
          </dl>
          <Link to="/admin/notify" className="kb-btn kb-btn--primary kb-btn--md mt-6 w-full"><Icon name="megaphone" size={16} />Message hosts</Link>
        </Card>
      </div>
    </div>
  );
}

function PlanModal({ host, onClose, onSaved }: { host: Host; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [plan, setPlan] = useState<"free" | "pro">(isPro(host) ? "pro" : "free");
  const [months, setMonths] = useState("1");
  const [tvs, setTvs] = useState(String(Math.max(1, host.pro_tvs)));
  const [trial, setTrial] = useState(false);
  const [busy, setBusy] = useState(false);
  const q = quote(Number(tvs) || 1, 1);
  const save = async () => {
    setBusy(true);
    try {
      const until = plan === "pro" ? new Date(Date.now() + (Number(months) || 1) * 30 * 864e5).toISOString() : null;
      const { error } = await supabase.rpc("admin_set_plan", { p_user: host.id, p_plan: plan, p_until: until, p_tvs: plan === "pro" ? Number(tvs) || 1 : 1, p_trial: plan === "pro" && trial });
      if (error) throw error;
      toast("Plan updated. Logged in the audit log."); onSaved(); onClose();
    } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`Plan for ${host.name || host.email}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Save plan</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Plan">{(id) => <Select id={id} value={plan} onChange={(e) => setPlan(e.target.value as "free" | "pro")}><option value="pro">Pro</option><option value="free">Free</option></Select>}</Field>
        {plan === "pro" && <>
          <Field label="TVs">{(id) => <Input id={id} type="number" min={1} max={500} value={tvs} onChange={(e) => setTvs(e.target.value)} />}</Field>
          <Field label="Months from today">{(id) => <Input id={id} type="number" min={1} max={36} value={months} onChange={(e) => setMonths(e.target.value)} />}</Field>
          <Field label="Type">{(id) => <Select id={id} value={trial ? "trial" : "paid"} onChange={(e) => setTrial(e.target.value === "trial")}><option value="paid">Paid</option><option value="trial">Trial</option></Select>}</Field>
        </>}
      </div>
      {plan === "pro" && !trial && <p className="mt-4 rounded-md bg-mint-soft p-3 text-sm">First month for {q.tvs} TV{q.tvs > 1 ? "s" : ""}: <b>{formatMoney(q.total, "KES")}</b>{q.bulk ? " (15% multi-TV discount applied)" : ""}. Months 1-3 at KES 399 per TV, then KES 499.</p>}
    </Modal>
  );
}

function Hosts() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Host[] | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "pro" | "trial" | "free">("all");
  const [edit, setEdit] = useState<Host | null>(null);
  const load = () => supabase.rpc("admin_hosts").then(({ data }) => setRows((data as Host[]) || []));
  useEffect(() => { load(); }, []);
  const list = useMemo(() => (rows || []).filter((h) => {
    const t = q.trim().toLowerCase();
    if (t && !`${h.name} ${h.email} ${h.business_name} ${h.whatsapp}`.toLowerCase().includes(t)) return false;
    if (filter === "pro") return isPro(h) && !h.trial;
    if (filter === "trial") return isPro(h) && h.trial;
    if (filter === "free") return !isPro(h);
    return true;
  }), [rows, q, filter]);
  if (!rows) return <PageLoader />;
  return (
    <div className="space-y-5">
      <PageHeader title="Hosts" subtitle={`${rows.length} accounts`} />
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, business, phone" aria-label="Search hosts" className="sm:max-w-xs" />
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Filter">
            {(["all", "pro", "trial", "free"] as const).map((f) => (
              <button key={f} role="radio" aria-checked={filter === f} onClick={() => setFilter(f)} className={`rounded-full border px-4 py-1.5 text-sm font-semibold capitalize ${filter === f ? "border-ink bg-ink text-on-ink" : "border-line"}`}>{f}</button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-ink-muted"><tr className="border-b border-line">
              <th className="px-4 py-3">Host</th><th className="px-4 py-3">Country</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Properties</th><th className="px-4 py-3">TVs</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3" />
            </tr></thead>
            <tbody>
              {list.map((h) => (
                <tr key={h.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3"><p className="font-semibold">{h.name || "No name"}{h.role === "admin" && <span className="ml-2"><Tag tone="ink">ADMIN</Tag></span>}</p><p className="text-xs text-ink-muted">{h.email}{h.business_name ? ` · ${h.business_name}` : ""}</p></td>
                  <td className="px-4 py-3"><span className="flex items-center gap-2"><Flag code={countryOf(h.country)?.flag || ""} />{countryOf(h.country)?.name || "Other"}</span></td>
                  <td className="px-4 py-3">{isPro(h) ? <><Tag tone="ink">{h.trial ? "TRIAL" : "PRO"}</Tag><p className="mt-1 text-xs text-ink-muted">{h.pro_tvs} TVs · until {new Date(h.plan_until!).toLocaleDateString()}</p></> : <Tag>FREE</Tag>}</td>
                  <td className="px-4 py-3 tabular-nums">{h.properties}</td>
                  <td className="px-4 py-3 tabular-nums">{h.tvs} <span className="text-xs text-ink-muted">({h.tvs_online} online)</span></td>
                  <td className="px-4 py-3 text-ink-muted">{timeAgo(h.created_at)}</td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEdit(h)}>Plan</Button>
                    <Button size="sm" variant="ghost" onClick={() => nav(`/admin/notify?to=${h.id}`)}>Message</Button>
                    {h.whatsapp && <a className="kb-btn kb-btn--ghost kb-btn--sm" href={`https://wa.me/${h.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">WhatsApp</a>}
                  </div></td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-muted">No hosts match.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      {edit && <PlanModal host={edit} onClose={() => setEdit(null)} onSaved={load} />}
    </div>
  );
}

interface Sent { id: string; user_id: string | null; title: string; body: string; link: string; tone: string; created_at: string }

function Notify() {
  const toast = useToast();
  const params = new URLSearchParams(window.location.search);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [sent, setSent] = useState<Sent[]>([]);
  const [f, setF] = useState({ to: params.get("to") || "", title: "", body: "", link: "", tone: "info" });
  const [busy, setBusy] = useState(false);
  const load = () => supabase.from("host_notifications").select("*").order("created_at", { ascending: false }).limit(30).then(({ data }) => setSent((data as Sent[]) || []));
  useEffect(() => { supabase.rpc("admin_hosts").then(({ data }) => setHosts((data as Host[]) || [])); load(); }, []);
  const linkOk = !f.link || /^(\/|https:\/\/)/.test(f.link);
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.title.trim() || !linkOk) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("admin_notify", { p_user: f.to || null, p_title: f.title.trim(), p_body: f.body.trim(), p_link: f.link.trim(), p_tone: f.tone });
      if (error) throw error;
      toast(f.to ? "Sent to the host." : "Sent to every host.");
      setF({ ...f, title: "", body: "", link: "" }); load();
    } catch (err) { toast(errorMessage(err), "error"); } finally { setBusy(false); }
  };
  const who = (id: string | null) => (id ? hosts.find((h) => h.id === id)?.email || "One host" : "All hosts");
  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" subtitle="Messages appear in hosts' notification bell straight away." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card className="p-5 sm:p-6">
          <form onSubmit={send} className="space-y-4">
            <Field label="Send to">{(id) => (
              <Select id={id} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })}>
                <option value="">All hosts</option>
                {hosts.map((h) => <option key={h.id} value={h.id}>{h.name || h.email} ({h.email})</option>)}
              </Select>
            )}</Field>
            <Field label="Title">{(id) => <Input id={id} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={80} placeholder="New: Safari Lodge template" />}</Field>
            <Field label="Message" optional>{(id) => <Textarea id={id} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} maxLength={500} rows={3} />}</Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Link" optional error={linkOk ? "" : "Start with / or https://"} hint="e.g. /app/screens">{(id) => <Input id={id} value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} maxLength={300} />}</Field>
              <Field label="Style">{(id) => <Select id={id} value={f.tone} onChange={(e) => setF({ ...f, tone: e.target.value })}><option value="info">Announcement</option><option value="success">Good news</option><option value="warning">Action needed</option></Select>}</Field>
            </div>
            <Button type="submit" icon="megaphone" loading={busy} disabled={!f.title.trim() || !linkOk}>{f.to ? "Send to host" : "Send to all hosts"}</Button>
          </form>
        </Card>
        <Card className="p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold text-forest">Sent</h2>
          <ul className="mt-4 space-y-3">
            {sent.map((n) => (
              <li key={n.id} className="rounded-md border border-line p-3">
                <div className="flex items-center justify-between gap-2"><p className="font-semibold">{n.title}</p><span className="shrink-0 text-xs text-ink-muted">{timeAgo(n.created_at)}</span></div>
                {n.body && <p className="mt-1 text-sm text-ink-muted">{n.body}</p>}
                <p className="mt-2 text-xs font-semibold text-maroon">{who(n.user_id)}</p>
              </li>
            ))}
            {!sent.length && <li className="text-sm text-ink-muted">Nothing sent yet.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function SimpleTable<T extends { id: string | number; created_at: string }>({ title, subtitle, table, columns }: {
  title: string; subtitle: string; table: string; columns: { label: string; render: (r: T) => ReactNode }[];
}) {
  const [rows, setRows] = useState<T[] | null>(null);
  useEffect(() => { supabase.from(table).select("*").order("created_at", { ascending: false }).limit(200).then(({ data }) => setRows((data as T[]) || [])); }, [table]);
  if (!rows) return <PageLoader />;
  return (
    <div className="space-y-5">
      <PageHeader title={title} subtitle={subtitle} />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-ink-muted"><tr className="border-b border-line">{columns.map((c) => <th key={c.label} className="px-4 py-3">{c.label}</th>)}<th className="px-4 py-3">When</th></tr></thead>
          <tbody>
            {rows.map((r) => <tr key={r.id} className="border-b border-line align-top last:border-0">{columns.map((c) => <td key={c.label} className="px-4 py-3">{c.render(r)}</td>)}<td className="whitespace-nowrap px-4 py-3 text-ink-muted">{timeAgo(r.created_at)}</td></tr>)}
            {!rows.length && <tr><td colSpan={columns.length + 1} className="px-4 py-10 text-center text-ink-muted">Nothing yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

interface Lead { id: string; name: string; email: string; whatsapp: string; city: string; tv_brand: string; tv_count: number; message: string; created_at: string }
interface Pms { id: string; user_id: string; pms: string; details: string; created_at: string }
interface Audit { id: number; actor: string; action: string; target: string; detail: Record<string, unknown>; created_at: string }

const NAV = [
  { to: "/admin", label: "Overview", icon: "chart", end: true },
  { to: "/admin/hosts", label: "Hosts", icon: "users" },
  { to: "/admin/notify", label: "Notifications", icon: "megaphone" },
  { to: "/admin/leads", label: "Leads", icon: "mail" },
  { to: "/admin/pms", label: "PMS requests", icon: "link" },
  { to: "/admin/audit", label: "Audit log", icon: "shield" },
];

export default function Admin() {
  const { state, recheck } = useAdminGate();
  if (state === "loading") return <PageLoader />;
  if (state === "denied") return <Navigate to="/app" replace />;
  if (state === "need-setup") {
    return <GateScreen title="Turn on two-step verification">
      <p className="text-ink-muted">The admin area needs a code from an authenticator app. Set it up in Settings, then come back.</p>
      <Link to="/app/settings" className="kb-btn kb-btn--primary kb-btn--md mt-5 w-full">Open Settings</Link>
    </GateScreen>;
  }
  if (state === "need-code") return <GateScreen title="Admin verification"><CodeGate onDone={recheck} /></GateScreen>;
  return (
    <div className="min-h-[100dvh] bg-surface-wash lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="bg-navy text-bone lg:sticky lg:top-0 lg:h-[100dvh]">
        <div className="kb-kikoi kb-kikoi--thin" />
        <div className="flex items-center justify-between px-5 py-5"><Logo to="/admin" light /><span className="rounded-full bg-maroon px-2 py-0.5 text-[10px] font-bold tracking-wider text-white">ADMIN</span></div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible" aria-label="Admin">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `flex shrink-0 items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${isActive ? "bg-maroon text-white" : "text-bone/75 hover:bg-white/10 hover:text-bone"}`}>
              <Icon name={n.icon} size={17} />{n.label}
            </NavLink>
          ))}
          <Link to="/app" className="flex shrink-0 items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold text-bone/60 hover:text-bone lg:mt-4"><Icon name="chevron-left" size={17} />Host dashboard</Link>
        </nav>
      </aside>
      <main className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="hosts" element={<Hosts />} />
            <Route path="notify" element={<Notify />} />
            <Route path="leads" element={<SimpleTable<Lead> title="Leads" subtitle="From the website contact form." table="leads" columns={[
              { label: "Name", render: (r) => <><p className="font-semibold">{r.name}</p><p className="text-xs text-ink-muted">{r.city}</p></> },
              { label: "Contact", render: (r) => <>{r.whatsapp && <a className="block font-semibold text-maroon underline" href={`https://wa.me/${r.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">{r.whatsapp}</a>}{r.email && <a className="block text-xs underline" href={`mailto:${r.email}`}>{r.email}</a>}</> },
              { label: "TVs", render: (r) => `${r.tv_count} × ${r.tv_brand || "?"}` },
              { label: "Message", render: (r) => <span className="line-clamp-3">{r.message}</span> },
            ]} />} />
            <Route path="pms" element={<SimpleTable<Pms> title="PMS requests" subtitle="Property-management systems hosts asked us to support." table="pms_requests" columns={[
              { label: "PMS", render: (r) => <b>{r.pms}</b> }, { label: "Details", render: (r) => r.details },
            ]} />} />
            <Route path="audit" element={<SimpleTable<Audit> title="Audit log" subtitle="Every admin action, newest first. Read-only." table="audit_log" columns={[
              { label: "Action", render: (r) => <Tag tone="ink">{r.action}</Tag> }, { label: "Target", render: (r) => <code className="text-xs">{r.target}</code> },
              { label: "Detail", render: (r) => <code className="break-all text-xs">{JSON.stringify(r.detail)}</code> },
            ]} />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
