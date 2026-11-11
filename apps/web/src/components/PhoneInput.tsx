import { useEffect, useRef, useState } from "react";
import { BI, CD, ET, KE, RW, SO, SS, TZ, UG } from "country-flag-icons/react/3x2";
const Flags = { BI, CD, ET, KE, RW, SO, SS, TZ, UG }; // only the flags we use, so the bundle stays small
import { COUNTRIES, countryOf, joinPhone, splitPhone } from "@/lib/countries";
import type { CountryCode } from "@/lib/types";
import { Icon } from "./Icons";

export function Flag({ code, className = "h-4 w-6" }: { code: string; className?: string }) {
  const F = (Flags as Record<string, (p: { title?: string; className?: string }) => JSX.Element>)[code];
  return F ? <F className={`${className} shrink-0 rounded-[3px] shadow-[0_0_0_1px_rgba(23,24,42,.12)]`} /> : <Icon name="globe" size={16} />;
}

/**
 * Phone number with a fixed country prefix. Stores "+<dial><digits>".
 * The prefix follows `country` (e.g. the host's profile country) and can be changed from the flag menu.
 */
export function PhoneInput({ id, value, onChange, country, onCountryChange, describedBy, invalid, placeholder = "712 345 678" }: {
  id?: string; value: string; onChange: (full: string) => void; country?: CountryCode; onCountryChange?: (c: CountryCode) => void;
  describedBy?: string; invalid?: boolean; placeholder?: string;
}) {
  const parsed = splitPhone(value, country || "KE");
  const [cc, setCc] = useState<CountryCode>(parsed.country === "other" ? "KE" : parsed.country);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (country && country !== "other" && !value) setCc(country); }, [country, value]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const c = countryOf(cc) || COUNTRIES[0];
  const pick = (code: CountryCode) => { setCc(code); setOpen(false); onCountryChange?.(code); onChange(joinPhone(code, parsed.local)); };
  return (
    <div ref={ref} className={`relative flex items-stretch rounded-sm border-[1.5px] bg-surface transition-[border-color,box-shadow] focus-within:border-green focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--green)_20%,transparent)] ${invalid ? "border-danger" : "border-line-strong"}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} aria-label={`Country code ${c.name} ${c.dial}`}
        className="flex shrink-0 items-center gap-2 rounded-l-sm border-r border-line px-3 text-sm font-semibold text-ink hover:bg-surface-wash">
        <Flag code={c.flag} />{c.dial}<Icon name="chevron-down" size={12} className="text-ink-muted" />
      </button>
      <input id={id} type="tel" inputMode="tel" autoComplete="tel-national" value={parsed.local} placeholder={placeholder}
        aria-describedby={describedBy} aria-invalid={invalid || undefined}
        onChange={(e) => onChange(joinPhone(cc, e.target.value))}
        className="min-h-[44px] w-full min-w-0 rounded-r-sm bg-transparent px-3 text-ink outline-none placeholder:text-ink-muted/70" />
      {open && (
        <ul role="listbox" className="absolute left-0 top-full z-40 mt-1 max-h-72 w-64 overflow-auto rounded-md border border-line bg-surface p-1 shadow-panel">
          {COUNTRIES.map((x) => (
            <li key={x.code}>
              <button type="button" role="option" aria-selected={x.code === cc} onClick={() => pick(x.code)}
                className={`flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm hover:bg-mint-soft ${x.code === cc ? "font-semibold" : ""}`}>
                <Flag code={x.flag} /><span className="flex-1">{x.name}</span><span className="text-ink-muted">{x.dial}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
