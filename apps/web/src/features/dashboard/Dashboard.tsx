import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { CONFIG } from "@/lib/config";
import { addDays, fmtDateLong, timeAgo, todayIn } from "@/lib/dates";
import type { Calendar, ScreenState, Stay } from "@/lib/types";
import { Icon } from "@/components/Icons";
import { Button, ButtonLink, Card, EmptyState, Tag } from "@/components/ui";
import { RoomMockup } from "@/features/tv/WelcomeScreen";
import { useData } from "./data";
import { StayForm } from "./shared/StayForm";
import { StayRow } from "./shared/StayList";
import { PropertySwitcher, STATE_LABELS, usePreview } from "./shared/widgets";
import { PROVIDERS } from "./Integrations";

const STATES: ScreenState[] = ["arriving", "checkout", "between"];

function Stat({ icon, value, label, tone }: { icon: string; value: number; label: string; tone: string }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-md ${tone}`}><Icon name={icon} size={26} /></span>
      <div><p className="font-display text-3xl font-semibold leading-none text-ink">{value}</p><p className="mt-1 text-sm text-ink-muted">{label}</p></div>
    </Card>
  );
}

export function PreviewCarousel() {
  const { selected } = useData();
  const nav = useNavigate();
  const [i, setI] = useState<number | null>(null);
  const { live } = usePreview(selected);
  const index = i ?? Math.max(0, STATES.indexOf(live || "arriving"));
  const state = STATES[index];
  const { payload } = usePreview(selected, { state });
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-forest"><Icon name="tv" />TV welcome screen preview</h2>
        <button onClick={() => nav("/app/screens")} className="rounded-sm border border-line p-2 text-ink-muted hover:bg-mint-soft" aria-label="Open TV Screens"><Icon name="arrow-right" size={18} /></button>
      </div>
      {payload && <RoomMockup payload={payload} />}
      <div className="mt-4 flex items-center justify-center gap-4">
        <button onClick={() => setI((index + 2) % 3)} className="rounded-full p-2 hover:bg-mint-soft" aria-label="Previous screen"><Icon name="chevron-left" size={20} /></button>
        {STATES.map((s, j) => <button key={s} onClick={() => setI(j)} aria-label={STATE_LABELS[s].title} aria-current={j === index} className={`h-2.5 rounded-full transition-all ${j === index ? "w-7 bg-forest" : "w-2.5 bg-forest/25"}`} />)}
        <button onClick={() => setI((index + 1) % 3)} className="rounded-full p-2 hover:bg-mint-soft" aria-label="Next screen"><Icon name="chevron-right" size={20} /></button>
      </div>
      <p className="mt-1 flex items-center justify-center gap-2 text-sm text-ink-muted" aria-live="polite">
        {STATE_LABELS[state].title}{live === state && <Tag>On TV now</Tag>}
      </p>
    </Card>
  );
}

export default function Dashboard() {
  const { profile, plan } = useAuth();
  const { properties, selected, devices, staysVersion } = useData();
  const nav = useNavigate();
  const [stays, setStays] = useState<Stay[]>([]);
  const [total, setTotal] = useState(0);
  const [cals, setCals] = useState<Calendar[]>([]);
  const [adding, setAdding] = useState(false);
  const today = todayIn(selected?.timezone);

  useEffect(() => {
    if (!selected) return;
    supabase.from("stays").select("*, calendars(label, provider)").eq("property_id", selected.id).eq("cancelled", false).gte("checkout", today).order("checkin")
      .then(({ data }) => setStays((data as Stay[]) || []));
    supabase.from("stays").select("id", { count: "exact", head: true }).eq("property_id", selected.id).eq("cancelled", false)
      .then(({ count }) => setTotal(count || 0));
    supabase.from("calendars").select("*").eq("property_id", selected.id).order("created_at")
      .then(({ data }) => setCals((data as Calendar[]) || []));
  }, [selected?.id, staysVersion, today]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!properties.length && !profile?.onboarding?.done) return <Navigate to="/app/welcome" replace />;
  if (!selected) {
    return <Card><EmptyState icon="building" title="Add your first property" body="Set up the Wi-Fi, house rules and screen for one place." action={<ButtonLink to="/app/welcome">Get started</ButtonLink>} /></Card>;
  }

  const active = stays.filter((s) => s.checkin <= today && today < s.checkout).length;
  const upcoming = stays.filter((s) => s.checkin > today && s.checkin <= addDays(today, 30)).length;
  const first = (profile?.name || "").split(" ")[0];
  const tvs = devices.filter((d) => d.property_id === selected.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-display-sm text-forest sm:text-[2.25rem]">Welcome back{first ? `, ${first}` : ""}!</h1>
          <p className="mt-1 text-ink-muted">Manage your properties, bookings and guest welcome screens in one place.</p>
        </div>
        <PropertySwitcher />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon="home" value={properties.length} label={properties.length === 1 ? "Property" : "Properties"} tone="bg-[#fde7ef] text-[#b4235a]" />
        <Stat icon="guests" value={active} label="Active guests" tone="bg-mint-soft text-forest" />
        <Stat icon="calendar" value={upcoming} label="Upcoming check-ins" tone="bg-[#fff1cc] text-[#9a6700]" />
        <Stat icon="building" value={total} label="Total bookings" tone="bg-[#e3ecff] text-[#2550b8]" />
      </div>

      {plan.trial && (
        <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">Free Pro trial <Tag>{plan.daysLeft} days left · until {fmtDateLong(plan.until || "")}</Tag></p>
            <p className="mt-1 text-sm text-ink-muted">Everything in Pro for now. Upgrade before it ends to keep it; otherwise you move to the Free plan.</p>
          </div>
          <ButtonLink to="/app/billing">Upgrade to keep Pro</ButtonLink>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <PreviewCarousel />
        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold text-forest"><Icon name="bolt" className="text-[#d97706]" />Quick actions</h2>
          <div className="space-y-3">
            {[
              { to: "/app/screens", icon: "pencil", label: "Edit welcome screen", tone: "bg-[#f1ecff] text-[#6d28d9]" },
              { to: "/app/wifi", icon: "wifi", label: "Update Wi-Fi / QR code", tone: "bg-mint-soft text-forest" },
              { to: "/app/rules", icon: "clipboard", label: "Manage house rules", tone: "bg-[#fff4e5] text-[#b45309]" },
            ].map((a) => (
              <Link key={a.to} to={a.to} className={`flex items-center gap-3 rounded-md px-4 py-3.5 font-semibold transition-transform hover:translate-x-0.5 ${a.tone}`}>
                <Icon name={a.icon} /><span className="flex-1 text-ink">{a.label}</span><Icon name="chevron-right" size={18} />
              </Link>
            ))}
            <button onClick={() => setAdding(true)} className="flex w-full items-center gap-3 rounded-md bg-[#e8f0ff] px-4 py-3.5 text-left font-semibold text-[#2550b8] transition-transform hover:translate-x-0.5">
              <Icon name="calendar" /><span className="flex-1 text-ink">Add a booking</span><Icon name="chevron-right" size={18} />
            </button>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-forest"><Icon name="calendar" />Upcoming bookings</h2>
            <Link to="/app/bookings" className="flex items-center gap-1 text-sm font-semibold text-green">View all <Icon name="arrow-right" size={16} /></Link>
          </div>
          {stays.length ? (
            <ul className="mt-3 divide-y divide-line">{stays.slice(0, 4).map((s) => <StayRow key={s.id} stay={s} property={selected} onClick={() => nav("/app/bookings")} />)}</ul>
          ) : <p className="px-5 pb-6 pt-3 text-sm text-ink-muted">No upcoming bookings yet. Add one, or connect your Airbnb calendar under Integrations and they appear here by themselves.</p>}
        </Card>
        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-forest"><Icon name="link" />Calendar integrations</h2>
          <p className="mt-1 text-sm text-ink-muted">Keep your bookings in sync automatically.</p>
          <ul className="mt-4 space-y-2">
            {cals.map((c) => {
              const pr = PROVIDERS.find((x) => x.key === c.provider) || PROVIDERS[4];
              return (
                <li key={c.id} className="flex items-center gap-3 rounded-md border border-line px-3 py-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-sm text-sm font-bold" style={{ background: pr.bg, color: pr.fg }}>{pr.mark}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{c.label || pr.name}</span><span className="block text-xs text-ink-muted">{c.last_status === "error" ? c.last_error : `Synced ${timeAgo(c.last_synced || "")} · ${c.event_count} bookings`}</span></span>
                  {c.last_status === "ok" ? <Tag>Connected</Tag> : c.last_status === "error" ? <Tag tone="danger">Error</Tag> : <Tag tone="muted">Pending</Tag>}
                </li>
              );
            })}
          </ul>
          <button onClick={() => nav("/app/integrations")} className="mt-3 flex items-center gap-2 rounded-md border border-dashed border-line-strong px-5 py-3 text-sm font-semibold text-ink hover:bg-mint-soft"><Icon name="plus" size={18} />Add integration</button>
        </Card>
      </div>

      <Card className="grid items-center gap-6 overflow-hidden p-5 md:grid-cols-[1.1fr_1fr]">
        <div className="relative overflow-hidden rounded-lg">
          <img src="/mockups/living-room.jpg" alt="" className="h-56 w-full object-cover object-[50%_35%]" />
          <div className="absolute left-1/2 top-[22%] flex h-20 w-20 -translate-x-1/2 items-center justify-center rounded-md bg-white shadow-panel"><Icon name="qr" size={44} /></div>
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold text-forest">{tvs.length ? `${tvs.length} TV${tvs.length > 1 ? "s" : ""} connected` : "Connect your TV"}</h2>
          <p className="mt-2 text-ink-muted">{tvs.length ? "Add another TV in seconds with the 6-character code it shows." : "Pair your TV in seconds with a simple 6-character code."}</p>
          <Button className="mt-5" onClick={() => nav("/app/tvs?pair=1")}>Pair TV device <Icon name="arrow-right" size={18} /></Button>
          <p className="mt-4 flex items-start gap-2 text-sm text-ink-muted"><Icon name="download" size={18} className="mt-0.5 shrink-0" />
            <span>New TV? Install the app first{CONFIG.app_short_url ? <>: type <b className="text-ink">{CONFIG.app_short_url}</b> in the TV's browser or Downloader app.</> : <> — see <Link to="/app/tvs" className="font-semibold text-green underline">TV Devices</Link>.</>}</span>
          </p>
        </div>
      </Card>

      <StayForm open={adding} onClose={() => setAdding(false)} onSaved={() => {}} properties={properties} defaultProperty={selected.id} />
    </div>
  );
}
