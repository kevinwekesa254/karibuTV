import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { BRAND, waLink } from "@/lib/brand";
import { todayIn, tvStatus } from "@/lib/dates";
import type { Calendar, Stay } from "@/lib/types";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icons";
import { PageLoader } from "@/components/ui";
import { DataProvider, useData } from "./data";
import { UpgradeSheet } from "./shared/UpgradeSheet";

const NAV = [
  { to: "/app", label: "Dashboard", icon: "home", end: true },
  { to: "/app/properties", label: "Properties", icon: "building" },
  { to: "/app/bookings", label: "Bookings", icon: "calendar" },
  { to: "/app/screens", label: "TV Screens", icon: "tv" },
  { to: "/app/guide", label: "Guide & Extras", icon: "pin" },
  { to: "/app/wifi", label: "Wi-Fi & QR Code", icon: "wifi" },
  { to: "/app/rules", label: "House Rules", icon: "clipboard" },
  { to: "/app/integrations", label: "Integrations", icon: "link" },
  { to: "/app/tvs", label: "TV Devices", icon: "tv-signal" },
  { to: "/app/billing", label: "Billing", icon: "card" },
  { to: "/app/settings", label: "Settings", icon: "settings" },
];
const TABS = [
  { to: "/app", label: "Home", icon: "home", end: true },
  { to: "/app/bookings", label: "Bookings", icon: "calendar" },
  { to: "/app/screens", label: "Screens", icon: "tv" },
  { to: "/app/tvs", label: "TVs", icon: "tv-signal" },
  { to: "/app/more", label: "More", icon: "more", match: ["/app/more", "/app/guide", "/app/properties", "/app/wifi", "/app/rules", "/app/integrations", "/app/billing", "/app/settings"] },
];

function Sidebar() {
  const { plan } = useAuth();
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col overflow-y-auto bg-[#0b2a1c] text-[#fff6e9] lg:flex">
      <div className="kb-kikoi kb-kikoi--thin" />
      <div className="px-6 py-6"><Logo to="/app" light /></div>
      <nav className="space-y-0.5 px-3" aria-label="Main">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => `flex items-center gap-3 rounded-full px-4 py-2.5 text-[0.9375rem] font-semibold transition-colors ${isActive ? "bg-sun text-on-sun shadow-[0_6px_20px_-8px_rgba(242,107,58,.8)]" : "text-[#fff6e9]/80 hover:bg-white/10 hover:text-[#fff6e9]"}`}>
            <Icon name={n.icon} />{n.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto p-3">
        <Link to="/app/screens" className="group relative block overflow-hidden rounded-lg">
          <img src="/templates/coast.jpg" alt="" className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute inset-x-4 bottom-4 text-white">
            <p className="font-display text-lg font-semibold leading-tight">Create a memorable guest experience</p>
            <span className="mt-2 block h-1 w-10 rounded-full bg-sun" />
          </div>
        </Link>
        <div className="mt-3 flex items-center justify-between rounded-md bg-white/10 px-4 py-3">
          <div>
            <p className="text-sm font-semibold">{plan.trial ? "Pro trial" : plan.pro ? "Pro plan" : "Free plan"}</p>
            <p className="text-xs text-[#fff6e9]/70">{plan.trial ? `${plan.daysLeft} days left` : plan.pro ? `${plan.maxTvs} TV${plan.maxTvs > 1 ? "s" : ""}` : "1 TV · 1 property"}</p>
          </div>
          {plan.pro ? <span className="rounded-full bg-sun px-2 py-0.5 text-xs font-bold text-on-sun">PRO</span> : <Link to="/app/billing" className="text-sm font-semibold text-sun underline">Upgrade</Link>}
        </div>
      </div>
    </aside>
  );
}

function useOutside<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", h); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [open, close]);
  return ref;
}

function Search() {
  const { properties } = useData();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [guests, setGuests] = useState<Stay[]>([]);
  const ref = useOutside<HTMLDivElement>(open, () => setOpen(false));

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setGuests([]); return; }
    const id = window.setTimeout(async () => {
      const safe = term.replace(/[%,()]/g, " ");
      const { data } = await supabase.from("stays").select("*").or(`first_name.ilike.%${safe}%,note.ilike.%${safe}%`).order("checkin", { ascending: false }).limit(6);
      setGuests((data as Stay[]) || []);
    }, 250);
    return () => window.clearTimeout(id);
  }, [q]);

  const props = q.trim().length >= 2 ? properties.filter((p) => `${p.name} ${p.area}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 4) : [];
  const go = (to: string) => { setOpen(false); setQ(""); nav(to); };

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <Icon name="search" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
      <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === "Enter" && q.trim()) go(`/app/bookings?q=${encodeURIComponent(q.trim())}`); }}
        placeholder="Search bookings, guests, properties…" aria-label="Search"
        className="h-11 w-full rounded-full border border-line bg-surface pl-11 pr-4 text-sm outline-none focus:border-green focus:ring-2 focus:ring-green/20" />
      {open && (props.length > 0 || guests.length > 0) && (
        <div className="absolute left-0 right-0 z-50 mt-2 rounded-md border border-line bg-surface p-1 shadow-panel">
          {props.length > 0 && <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">Properties</p>}
          {props.map((p) => <button key={p.id} onClick={() => go(`/app/properties/${p.id}`)} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-mint-soft"><Icon name="building" size={16} />{p.name}</button>)}
          {guests.length > 0 && <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">Guests</p>}
          {guests.map((s) => (
            <button key={s.id} onClick={() => go(`/app/bookings?q=${encodeURIComponent(s.first_name || q)}`)} className="flex w-full items-center justify-between gap-2 rounded px-3 py-2 text-left text-sm hover:bg-mint-soft">
              <span className="flex items-center gap-2"><Icon name="guests" size={16} />{s.first_name || "Guest name missing"}</span>
              <span className="text-xs text-ink-muted">{s.checkin} → {s.checkout}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface Note { icon: string; text: string; to: string; tone?: "danger" | "warning" }

function useNotifications(): Note[] {
  const { devices, properties, staysVersion } = useData();
  const { plan } = useAuth();
  const [missing, setMissing] = useState(0);
  const [calErrors, setCalErrors] = useState(0);
  useEffect(() => {
    const today = todayIn(properties[0]?.timezone);
    supabase.from("stays").select("id", { count: "exact", head: true }).eq("first_name", "").eq("cancelled", false).gte("checkout", today)
      .then(({ count }) => setMissing(count || 0));
    supabase.from("calendars").select("id, last_status").eq("last_status", "error")
      .then(({ data }) => setCalErrors(((data as Calendar[]) || []).length));
  }, [staysVersion, properties]);
  return useMemo(() => {
    const out: Note[] = [];
    const off = devices.filter((d) => d.property_id && tvStatus(d.last_seen || "") === "offline");
    if (off.length) out.push({ icon: "offline", text: `${off.length} TV${off.length > 1 ? "s are" : " is"} offline`, to: "/app/tvs", tone: "danger" });
    if (missing) out.push({ icon: "guests", text: `${missing} booking${missing > 1 ? "s need" : " needs"} a guest name`, to: "/app/bookings" });
    if (calErrors) out.push({ icon: "calendar", text: `${calErrors} calendar${calErrors > 1 ? "s" : ""} failed to sync`, to: "/app/integrations", tone: "danger" });
    if (plan.trial && plan.daysLeft <= 7) out.push({ icon: "clock", text: `Your Pro trial ends in ${plan.daysLeft} day${plan.daysLeft === 1 ? "" : "s"}`, to: "/app/billing", tone: "warning" });
    const noWifi = properties.filter((p) => !p.wifi_ssid);
    if (noWifi.length) out.push({ icon: "wifi", text: `Add Wi-Fi for ${noWifi[0].name}`, to: "/app/wifi" });
    return out;
  }, [devices, properties, missing, calErrors, plan]);
}

function Popover({ button, children, label }: { button: ReactNode; children: (close: () => void) => ReactNode; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useOutside<HTMLDivElement>(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={label} className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-ink hover:bg-mint-soft">{button}</button>
      {open && <div className="absolute right-0 z-50 mt-2 w-72 rounded-md border border-line bg-surface p-1 shadow-panel">{children(() => setOpen(false))}</div>}
    </div>
  );
}

function TopBar() {
  const { user, profile, signOut } = useAuth();
  const nav = useNavigate();
  const notes = useNotifications();
  const name = profile?.name || user?.email || "Host";
  const item = "flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-mint-soft";
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface-wash/90 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-10">
        <div className="lg:hidden"><Logo to="/app" size={28} className="[&>span]:hidden xs:[&>span]:inline" /></div>
        <div className="hidden flex-1 justify-center md:flex"><Search /></div>
        <div className="ml-auto flex items-center gap-1">
          <Popover label="Help" button={<><Icon name="help" /><span className="hidden sm:inline">Help</span></>}>
            {(close) => (
              <>
                <a className={item} href={waLink(BRAND.supportWhatsApp, "Hi! I need help with Karibu TV.")} target="_blank" rel="noreferrer" onClick={close}><Icon name="phone" size={16} />Chat with us on WhatsApp</a>
                <button className={item} onClick={() => { close(); nav("/app/tvs"); }}><Icon name="tv" size={16} />Install the app on a TV</button>
                <a className={item} href="/#faq" target="_blank" rel="noreferrer" onClick={close}><Icon name="info" size={16} />Questions hosts ask</a>
                <a className={item} href={`mailto:${BRAND.email}`} onClick={close}><Icon name="mail" size={16} />{BRAND.email}</a>
              </>
            )}
          </Popover>
          <Popover label={`Notifications${notes.length ? `, ${notes.length} new` : ""}`} button={<span className="relative"><Icon name="bell" />{notes.length > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface-wash bg-danger" />}</span>}>
            {(close) => notes.length ? notes.map((n, i) => (
              <button key={i} className={item} onClick={() => { close(); nav(n.to); }}>
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${n.tone === "danger" ? "bg-danger/10 text-danger" : n.tone === "warning" ? "bg-warning/10 text-warning" : "bg-mint-soft text-forest"}`}><Icon name={n.icon} size={16} /></span>
                {n.text}
              </button>
            )) : <p className="px-3 py-4 text-sm text-ink-muted">You're all caught up.</p>}
          </Popover>
          <span className="mx-1 hidden h-8 w-px bg-line sm:block" />
          <Popover label="Account menu" button={<>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sun font-display font-semibold text-on-sun">{name[0].toUpperCase()}</span>
            <span className="hidden text-left sm:block"><span className="block max-w-[10rem] truncate leading-tight">{name}</span><span className="block text-xs font-normal text-ink-muted">Host</span></span>
            <Icon name="chevron-down" size={16} className="hidden sm:block" />
          </>}>
            {(close) => (
              <>
                <p className="truncate px-3 py-2 text-xs text-ink-muted">{user?.email}</p>
                <button className={item} onClick={() => { close(); nav("/app/settings"); }}><Icon name="settings" size={16} />Settings</button>
                <button className={item} onClick={() => { close(); nav("/app/billing"); }}><Icon name="card" size={16} />Billing</button>
                <button className={item} onClick={async () => { close(); await signOut(); nav("/signin"); }}><Icon name="logout" size={16} />Sign out</button>
              </>
            )}
          </Popover>
        </div>
      </div>
      <div className="px-4 pb-3 md:hidden"><Search /></div>
    </header>
  );
}

function TabBar() {
  const loc = useLocation();
  return (
    <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface lg:hidden">
      <div className="grid grid-cols-5">
        {TABS.map((t) => {
          const active = t.match ? t.match.some((m) => loc.pathname.startsWith(m)) : t.end ? loc.pathname === t.to : loc.pathname.startsWith(t.to);
          return (
            <NavLink key={t.to} to={t.to} end={t.end} aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${active ? "text-forest" : "text-ink-muted"}`}>
              <span className={`flex h-8 w-12 items-center justify-center rounded-full ${active ? "bg-sun text-on-sun" : ""}`}><Icon name={t.icon} size={21} /></span>
              {t.label}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

function Shell() {
  const { loading } = useData();
  return (
    <div className="min-h-screen bg-surface-wash">
      <Sidebar />
      <div className="lg:ml-64">
        <TopBar />
        <main className="px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">
          <div className="mx-auto max-w-6xl">{loading ? <PageLoader /> : <Outlet />}</div>
        </main>
      </div>
      <TabBar />
      <UpgradeSheet />
    </div>
  );
}

export default function DashboardLayout() {
  return <DataProvider><Shell /></DataProvider>;
}
