import type { Property, Stay } from "@/lib/types";
import { fmtRange, nightsBetween, dateOnly, todayIn } from "@/lib/dates";
import { Icon } from "@/components/Icons";
import { Tag } from "@/components/ui";

export function stayStatus(s: Stay, tz?: string): { label: string; tone: "mint" | "ink" | "muted" | "warning" } {
  const today = todayIn(tz);
  const ci = dateOnly(s.checkin), co = dateOnly(s.checkout);
  if (s.cancelled) return { label: "Cancelled", tone: "muted" };
  if (co === today) return { label: "Checks out today", tone: "warning" };
  if (ci === today) return { label: "Arrives today", tone: "ink" };
  if (ci < today && today < co) return { label: "Checked in", tone: "mint" };
  if (co < today) return { label: "Checked out", tone: "muted" };
  return { label: "Upcoming", tone: "mint" };
}

export function StayRow({ stay, property, showProperty, onClick }: { stay: Stay; property?: Property; showProperty?: boolean; onClick: () => void }) {
  const st = stayStatus(stay, property?.timezone);
  const n = nightsBetween(dateOnly(stay.checkin), dateOnly(stay.checkout));
  return (
    <li>
      <button onClick={onClick} className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-surface-wash sm:px-5">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display text-lg font-semibold ${stay.first_name ? "bg-mint text-on-mint" : "bg-line text-ink-muted"}`}>
          {stay.first_name ? stay.first_name[0].toUpperCase() : <Icon name="guests" size={20} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className={`font-semibold ${stay.first_name ? "text-ink" : "text-ink-muted"}`}>{stay.first_name || "Guest name missing"}</span>
            {stay.source === "ical" && <Tag tone="muted">From {stay.calendars?.label || "calendar"}</Tag>}
          </span>
          <span className="block text-sm text-ink-muted">
            {fmtRange(dateOnly(stay.checkin), dateOnly(stay.checkout))} · {n} night{n === 1 ? "" : "s"}{showProperty && property ? ` · ${property.name}` : ""}
          </span>
          {!stay.first_name && stay.source === "ical" && !stay.cancelled && <span className="mt-0.5 block text-sm font-semibold text-green">Add guest name →</span>}
        </span>
        <Tag tone={st.tone} className="hidden xs:inline-flex">{st.label}</Tag>
      </button>
    </li>
  );
}
