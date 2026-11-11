import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, mediaUrl } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { addDays, todayIn } from "@/lib/dates";
import { buildPayload, type StayLike } from "@/lib/screen";
import { qrSvg, wifiString } from "@/lib/qr";
import type { Property, ScreenPayload, ScreenState } from "@/lib/types";
import { Icon, RULE_ICONS } from "@/components/Icons";
import { Modal } from "@/components/ui";
import { useData } from "../data";

/** Property picker shown at the top right of property-scoped pages. */
export function PropertySwitcher({ allowAll, value, onChange }: { allowAll?: boolean; value?: string; onChange?: (id: string) => void }) {
  const { properties, selected, selectProperty } = useData();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = value !== undefined ? properties.find((p) => p.id === value) : selected;
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  if (!properties.length) return null;
  const pick = (id: string) => { setOpen(false); if (onChange) onChange(id); else selectProperty(id); };
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}
        className="flex min-w-[13rem] items-center gap-3 rounded-md border border-line bg-surface py-2 pl-2 pr-3 text-left shadow-card hover:border-line-strong">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-forest text-mint"><Icon name="home" size={20} /></span>
        <span className="min-w-0 flex-1 truncate font-display text-lg font-semibold text-ink">{current ? current.name : "All properties"}</span>
        <Icon name="chevron-down" size={18} />
      </button>
      {open && (
        <ul role="listbox" className="absolute right-0 z-40 mt-2 w-64 rounded-md border border-line bg-surface p-1 shadow-panel">
          {allowAll && <li><button onClick={() => pick("")} className={`w-full rounded px-3 py-2 text-left text-sm hover:bg-mint-soft ${!current ? "font-semibold" : ""}`}>All properties</button></li>}
          {properties.map((p) => (
            <li key={p.id}>
              <button role="option" aria-selected={current?.id === p.id} onClick={() => pick(p.id)}
                className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-mint-soft ${current?.id === p.id ? "font-semibold" : ""}`}>
                <span className="truncate">{p.name}</span>{current?.id === p.id && <Icon name="check" size={16} />}
              </button>
            </li>
          ))}
          <li className="border-t border-line pt-1"><button onClick={() => { setOpen(false); nav("/app/properties"); }} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-green hover:bg-mint-soft"><Icon name="plus" size={16} />Manage properties</button></li>
        </ul>
      )}
    </div>
  );
}

/** Non-cancelled stays around today for a property (what the TV would see). */
export function useNearbyStays(property: Property | undefined) {
  const { staysVersion } = useData();
  const [stays, setStays] = useState<StayLike[]>([]);
  useEffect(() => {
    if (!property) return;
    const today = todayIn(property.timezone);
    supabase.from("stays").select("first_name, checkin, checkout").eq("property_id", property.id).eq("cancelled", false)
      .lte("checkin", addDays(today, 2)).gte("checkout", addDays(today, -2))
      .then(({ data }) => setStays((data as StayLike[]) || []));
  }, [property?.id, staysVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  return stays;
}

/** Build a preview payload: the real state, or a forced one with a sample guest name. */
export function usePreview(property: Property | undefined, opts: { state?: ScreenState; sampleName?: string; overrides?: Partial<Property> } = {}) {
  const { plan } = useAuth();
  const stays = useNearbyStays(property);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(t); }, []);
  return useMemo<{ payload: ScreenPayload | null; live: ScreenState | null }>(() => {
    if (!property) return { payload: null, live: null };
    const merged = { ...property, ...(opts.overrides || {}) };
    const base = { property: merged, stays, plan: { pro: plan.pro }, nowMs: now, mediaUrl };
    const live = buildPayload(base).state;
    return { payload: buildPayload({ ...base, forceState: opts.state, sampleName: opts.sampleName }), live };
  }, [property, stays, plan.pro, now, opts.state, opts.sampleName, opts.overrides]);
}

export function WifiQrPreview({ ssid, password, security, showPassword }: { ssid: string; password: string; security: string; showPassword: boolean }) {
  const [svg, setSvg] = useState("");
  useEffect(() => { if (!ssid) { setSvg(""); return; } qrSvg(wifiString(security, ssid, password)).then(setSvg); }, [ssid, password, security]);
  return (
    <div className="rounded-lg bg-[#0c1f16] p-5 text-[#f2fff0]">
      <div className="flex items-center gap-2 font-display text-lg font-semibold"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-mint text-on-mint"><Icon name="wifi" size={18} /></span>Connect to Wi-Fi</div>
      <div className="mt-4 flex items-center gap-4">
        <div className="h-36 w-36 shrink-0 rounded-md bg-white p-2.5 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} aria-label="Wi-Fi QR code" role="img" />
        <p className="text-sm text-[#a9bfb2]">{ssid ? "Scan with your phone camera" : "Add your network name to see the QR code."}</p>
      </div>
      {ssid && (
        <dl className="mt-4 space-y-2 text-sm">
          <div><dt className="text-[#a9bfb2]">Network</dt><dd className="break-all text-base font-semibold">{ssid}</dd></div>
          <div><dt className="text-[#a9bfb2]">Password</dt><dd className="break-all font-mono text-base font-semibold">
            {security === "nopass" ? "No password needed" : showPassword ? password || "—" : <span className="font-sans font-medium">Hidden (still inside the QR code)</span>}
          </dd></div>
        </dl>
      )}
    </div>
  );
}

export function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-line-strong bg-mint-soft text-forest hover:border-green" aria-label={`Icon: ${value.replace(/-/g, " ")}. Change icon`}>
        <Icon name={value} size={22} />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Choose an icon">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {RULE_ICONS.map((ic) => (
            <button key={ic} type="button" onClick={() => { onChange(ic); setOpen(false); }} aria-pressed={ic === value} aria-label={ic.replace(/-/g, " ")}
              className={`flex aspect-square items-center justify-center rounded-md border ${ic === value ? "border-forest bg-mint" : "border-line hover:bg-mint-soft"}`}>
              <Icon name={ic} size={26} />
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}

export const STATE_LABELS: Record<ScreenState, { title: string; body: string; photo: keyof Property }> = {
  arriving: { title: "During the stay", body: "Greets the guest by name while they stay", photo: "photo_welcome" },
  checkout: { title: "Check-out day", body: "Check-out time and steps on the last morning", photo: "photo_checkout" },
  between: { title: "No booking", body: "Shows when nobody is booked", photo: "photo_generic" },
};
