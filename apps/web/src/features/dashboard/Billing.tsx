import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { CONFIG } from "@/lib/config";
import { BRAND, waLink } from "@/lib/brand";
import { fmtDateLong } from "@/lib/dates";
import type { Payment } from "@/lib/types";
import { Icon, WhatsAppIcon } from "@/components/Icons";
import { Button, Card, PageHeader, Segmented, Tag } from "@/components/ui";
import { useData } from "./data";
import { PRO_FEATURES } from "./shared/UpgradeSheet";

export default function Billing() {
  const { user, profile, plan } = useAuth();
  const { devices, properties } = useData();
  const cfg = CONFIG;
  const [period, setPeriod] = useState<"month" | "year">("month");
  const [currency, setCurrency] = useState<"KES" | "USD">(profile?.country === "KE" || !profile?.country ? "KES" : "USD");
  const paired = devices.filter((d) => d.property_id).length;
  const [tvs, setTvs] = useState(Math.max(1, paired, plan.pro ? plan.maxTvs : 1));
  const [payments, setPayments] = useState<Payment[]>([]);
  useEffect(() => { supabase.from("payments").select("*").order("created_at", { ascending: false }).then(({ data }) => setPayments((data as Payment[]) || [])); }, []);

  const unit = cfg.prices[currency][period];
  const total = unit * tvs;
  const money = (n: number) => (currency === "KES" ? `KES ${n.toLocaleString()}` : `US$${n.toLocaleString()}`);
  const wa = BRAND.supportWhatsApp;
  const msg = `Hi! I'd like Karibu TV Pro for ${tvs} TV${tvs > 1 ? "s" : ""}, paid ${period === "month" ? "monthly" : "yearly"} (${money(total)}). Account: ${user?.email}`;

  return (
    <div>
      <PageHeader title="Billing" subtitle="Plans are priced per TV." />
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Card className="p-5 sm:p-6">
          <p className="kb-eyebrow">Current plan</p>
          <div className="mt-2 flex items-center gap-2">
            <h2 className="font-display text-display-sm text-forest">{plan.trial ? "Pro trial" : plan.pro ? "Pro" : "Free"}</h2>
            {plan.pro ? <Tag tone="ink">PRO</Tag> : <Tag>FREE</Tag>}
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-ink-muted">TVs</dt><dd className="font-display text-2xl font-semibold">{paired} <span className="text-base text-ink-muted">/ {plan.maxTvs}</span></dd></div>
            <div><dt className="text-ink-muted">Properties</dt><dd className="font-display text-2xl font-semibold">{properties.length} <span className="text-base text-ink-muted">/ {plan.maxProperties}</span></dd></div>
            {plan.pro && <div className="col-span-2"><dt className="text-ink-muted">{plan.trial ? "Trial ends" : "Renews"}</dt><dd className="font-semibold">{fmtDateLong(plan.until || "")}{plan.trial ? ` · ${plan.daysLeft} days left` : ""}</dd></div>}
            {!plan.pro && profile?.plan === "pro" && profile.plan_until && <div className="col-span-2"><dt className="text-ink-muted">Pro ended</dt><dd className="font-semibold text-danger">{fmtDateLong(profile.plan_until)}: calendar sync is paused and extra TVs show a renew note.</dd></div>}
          </dl>
          <ul className="mt-6 space-y-2.5 border-t border-line pt-5">
            {PRO_FEATURES.map((f) => (
              <li key={f.text} className="flex items-start gap-2.5 text-sm">
                <Icon name={plan.pro ? "check" : f.icon} size={18} className={plan.pro ? "text-green" : "text-ink-muted"} />
                <span className={plan.pro ? "" : "text-ink-muted"}>{f.text}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-forest">{plan.pro ? "Change or renew Pro" : "Upgrade to Pro"}</h2>
            {cfg.founding_offer.active && <Tag>{cfg.founding_offer.label}</Tag>}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Segmented label="Billing period" value={period} onChange={setPeriod} options={[{ value: "month", label: "Monthly" }, { value: "year", label: "Yearly · 2 months free" }]} />
            <Segmented label="Currency" value={currency} onChange={setCurrency} size="sm" options={[{ value: "KES", label: "KES" }, { value: "USD", label: "USD" }]} />
          </div>
          <div className="mt-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-ink">Number of TVs</p>
              <p className="text-sm text-ink-muted">{money(unit)} per TV / {period}</p>
            </div>
            <div className="flex items-center gap-1 rounded-full border border-line p-1">
              <button onClick={() => setTvs((n) => Math.max(1, n - 1))} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-mint-soft disabled:opacity-30" disabled={tvs <= 1} aria-label="Fewer TVs"><span className="text-xl leading-none">−</span></button>
              <span className="w-10 text-center font-display text-xl font-semibold" aria-live="polite">{tvs}</span>
              <button onClick={() => setTvs((n) => Math.min(50, n + 1))} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-mint-soft" aria-label="More TVs"><Icon name="plus" size={18} /></button>
            </div>
          </div>
          <div className="mt-6 flex items-baseline justify-between border-t border-line pt-5">
            <span className="font-semibold">Total</span>
            <span className="font-display text-3xl font-semibold text-forest">{money(total)}<span className="text-base font-normal text-ink-muted"> / {period}</span></span>
          </div>
          <div className="mt-6 space-y-3">
            <Button size="lg" className="w-full" disabled icon="phone">Pay with M-Pesa · coming soon</Button>
            <a className="kb-btn kb-btn--secondary kb-btn--lg w-full" href={waLink(wa, msg)} target="_blank" rel="noreferrer"><WhatsAppIcon size={20} />Upgrade on WhatsApp</a>
            <p className="text-center text-xs text-ink-muted">In-app M-Pesa and card payment is on the way. Until then we switch your account on as soon as you pay by M-Pesa to our till.</p>
          </div>
          {tvs > 4 && <p className="mt-4 text-sm text-ink-muted">5+ TVs? <a className="font-semibold text-green underline" href={waLink(wa, `Hi! I manage ${tvs} TVs and would like to talk about pricing.`)} target="_blank" rel="noreferrer">Talk to us on WhatsApp</a></p>}
        </Card>
      </div>

      <Card className="mt-5 overflow-hidden">
        <h2 className="border-b border-line px-5 py-4 font-display text-xl font-semibold text-forest">Payment history</h2>
        {payments?.length ? (
          <ul className="divide-y divide-line">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span>{fmtDateLong(p.created_at)} · {p.tvs} TV{p.tvs === 1 ? "" : "s"} · {p.period}</span>
                <span className="flex items-center gap-2">{p.currency} {p.amount.toLocaleString()} <Tag tone={p.status === "paid" ? "mint" : p.status === "failed" ? "danger" : "muted"}>{p.status}</Tag></span>
              </li>
            ))}
          </ul>
        ) : <p className="px-5 py-6 text-sm text-ink-muted">No payments yet.</p>}
      </Card>
    </div>
  );
}
