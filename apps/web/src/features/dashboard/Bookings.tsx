import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { todayIn } from "@/lib/dates";
import type { Stay } from "@/lib/types";
import { Icon } from "@/components/Icons";
import { Button, Card, EmptyState, PageHeader, PageLoader } from "@/components/ui";
import { useData } from "./data";
import { StayForm } from "./shared/StayForm";
import { StayRow } from "./shared/StayList";
import { PropertySwitcher, usePreview } from "./shared/widgets";

type Filter = "all" | "upcoming" | "in" | "out";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All bookings" }, { key: "upcoming", label: "Upcoming" }, { key: "in", label: "Checked-in" }, { key: "out", label: "Checked-out" },
];

function OnTvNow() {
  const { selected } = useData();
  const { payload } = usePreview(selected);
  if (!selected || !payload) return null;
  const name = payload.stay?.first_name;
  const text = payload.state === "arriving"
    ? (name ? `“Welcome, ${name}!”` : "“Welcome!” (add the guest's name to greet them)")
    : payload.state === "checkout" ? `“Check-out today by ${payload.property.checkout_time}”${name ? ` for ${name}` : ""}`
    : `“${payload.property.generic_title || `Welcome to ${selected.name}`}” (nobody booked tonight)`;
  return (
    <Card className="mb-5 flex items-center gap-4 border-mint bg-mint-soft/60 p-4">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-mint text-forest"><Icon name="tv" /></span>
      <div><p className="kb-eyebrow">On the TV now · {selected.name}</p><p className="font-display text-lg font-semibold text-ink">{text}</p></div>
    </Card>
  );
}

export default function Bookings() {
  const { properties, selected, staysVersion, bumpStays } = useData();
  const [params, setParams] = useSearchParams();
  const [prop, setProp] = useState<string>(selected?.id || "");
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState(params.get("q") || "");
  const [edit, setEdit] = useState<Stay | null | undefined>(undefined);
  const [stays, setStays] = useState<Stay[] | null>(null);
  const tz = properties.find((p) => p.id === prop)?.timezone || properties[0]?.timezone;
  const today = todayIn(tz);

  useEffect(() => { setQ(params.get("q") || ""); }, [params]);
  useEffect(() => {
    let query = supabase.from("stays").select("*, calendars(label, provider)").order("checkin", { ascending: false }).limit(500);
    if (prop) query = query.eq("property_id", prop);
    query.then(({ data }) => setStays((data as Stay[]) || []));
  }, [prop, staysVersion]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (stays || []).filter((s) => {
      if (term && !`${s.first_name} ${s.note}`.toLowerCase().includes(term)) return false;
      if (filter === "upcoming") return !s.cancelled && s.checkin > today;
      if (filter === "in") return !s.cancelled && s.checkin <= today && today < s.checkout;
      if (filter === "out") return s.checkout <= today;
      return true;
    }).sort((a, b) => (filter === "out" ? b.checkin.localeCompare(a.checkin) : a.checkin.localeCompare(b.checkin)));
  }, [stays, q, filter, today]);

  const needNames = (stays || []).filter((s) => !s.first_name && !s.cancelled && s.checkout >= today).length;

  return (
    <div>
      <PageHeader title={<span className="flex items-center gap-3"><Icon name="calendar" size={28} />Bookings</span>} subtitle="View and manage all guest bookings."
        actions={<><PropertySwitcher allowAll value={prop} onChange={setProp} />{properties.length > 0 && <Button icon="plus" onClick={() => setEdit(null)}>Add booking</Button>}</>} />
      <OnTvNow />
      {needNames > 0 && (
        <div className="mb-5 rounded-md bg-[#fff4e5] px-4 py-3 text-sm text-[#7a4100]">
          <b>{needNames} booking{needNames === 1 ? " needs" : "s need"} a guest name.</b> Tap a booking to add it, so the TV says “Welcome, Priya!” instead of “Welcome!”.
        </div>
      )}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4 sm:px-5">
          <div className="relative w-full sm:w-72">
            <Icon name="search" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input type="search" value={q} onChange={(e) => { setQ(e.target.value); if (params.get("q")) setParams({}); }} placeholder="Search guest name or note"
              className="kb-input !pl-10" aria-label="Search bookings" />
          </div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Filter bookings">
            {FILTERS.map((f) => (
              <button key={f.key} role="radio" aria-checked={filter === f.key} onClick={() => setFilter(f.key)}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${filter === f.key ? "border-ink bg-ink text-on-ink" : "border-line hover:border-line-strong"}`}>{f.label}</button>
            ))}
          </div>
        </div>
        {!properties.length ? <EmptyState icon="building" title="Add a property first" />
          : stays === null ? <PageLoader />
          : !list.length ? (
            <EmptyState icon="calendar" title={stays.length ? "No bookings match" : "No bookings yet"}
              body={stays.length ? "Try another filter or search." : "Add one for a guest who booked directly, or connect your Airbnb calendar under Integrations."}
              action={!stays.length ? <Button icon="plus" onClick={() => setEdit(null)}>Add booking</Button> : undefined} />
          ) : (
            <ul className="divide-y divide-line">
              {list.map((s) => <StayRow key={s.id} stay={s} property={properties.find((p) => p.id === s.property_id)} showProperty={!prop && properties.length > 1} onClick={() => setEdit(s)} />)}
            </ul>
          )}
      </Card>
      <StayForm open={edit !== undefined} stay={edit} onClose={() => setEdit(undefined)} onSaved={bumpStays} properties={properties} defaultProperty={prop || selected?.id} />
    </div>
  );
}
