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
import { formatMoney, periodTotal, quote, type Currency } from "@/lib/pricing";

export default function Billing() {
  const { user, profile, plan } = useAuth();
  const { devices, properties } = useData();
  const cfg = CONFIG;
  const [currency, setCurrency] = useState<Currency>(profile?.country === "KE" || !profile?.country ? "KES" : "USD");
  const paired = devices.filter((d) => d.property_id).length;
  const [tvs, setTvs] = useState(Math.max(1, paired, plan.pro ? plan.maxTvs : 1));
  const [payments, setPayments] = useState<Payment[]>([]);
  useEffect(() => { supabase.from("payments").select("*").order("created_at", { ascending: false }).then(({ data }) => setPayments((data as Payment[]) || [])); }, []);

  // Which paid month is next for this host (drives the intro price). Server is the source of truth.
  const subMonth = profile?.sub_started_at ? Math.max(1, Math.floor((Date.now() - Date.parse(profile.sub_started_at)) / (30.44 * 864e5)) + 1) : 1;
  const q = quote(tvs, subMonth, currency);
  const [server, setServer] = useState<{ total: number } | null>(null);
  useEffect(() => {
    setServer(null);
    const t = window.setTimeout(() => supabase.rpc("my_price_quote", { p_tvs: tvs, p_currency: currency }).then(({ data }) => setServer((data as { total: number }) || null)), 250);
    return () => window.clearTimeout(t);
  }, [tvs, currency]);
  const money = (n: number) => formatMoney(n, currency);
  const year = periodTotal(tvs, 12, currency);
  const wa = BRAND.supportWhatsApp;
  const msg = `Hi! I'd like Karibu TV Pro for ${tvs} TV${tvs > 1 ? "s" : ""} (${money(q.total)} this month). Account: ${user?.email}`;

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
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className={`rounded-md border-2 p-4 ${q.intro ? "border-maroon bg-mint-soft" : "border-line"}`}>
              <p className="text-xs font-semibold text-ink-muted">Months 1 to 3</p>
              <p className="mt-1 font-display text-2xl font-semibold">{money(quote(1, 1, currency).unit)}<span className="text-sm font-normal text-ink-muted"> per TV / month</span></p>
            </div>
            <div className={`rounded-md border-2 p-4 ${!q.intro ? "border-maroon bg-mint-soft" : "border-line"}`}>
              <p className="text-xs font-semibold text-ink-muted">From month 4</p>
              <p className="mt-1 font-display text-2xl font-semibold">{money(quote(1, 4, currency).unit)}<span className="text-sm font-normal text-ink-muted"> per TV / month</span></p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Segmented label="Currency" value={currency} onChange={setCurrency} size="sm" options={[{ value: "KES", label: "KES" }, { value: "USD", label: "USD" }]} />
            <p className="text-sm text-ink-muted">5 or more TVs: <b className="text-maroon">15% off</b> the whole bill.</p>
          </div>
          <div className="mt-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-ink">Number of TVs</p>
              <p className="text-sm text-ink-muted">{money(q.unit)} per TV this month ({q.intro ? `intro price, month ${q.month}` : "standard price"})</p>
            </div>
            <div className="flex items-center gap-1 rounded-full border border-line p-1">
              <button onClick={() => setTvs((n) => Math.max(1, n - 1))} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-mint-soft disabled:opacity-30" disabled={tvs <= 1} aria-label="Fewer TVs"><span className="text-xl leading-none">-</span></button>
              <span className="w-10 text-center font-display text-xl font-semibold tabular-nums" aria-live="polite">{tvs}</span>
              <button onClick={() => setTvs((n) => Math.min(500, n + 1))} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-mint-soft" aria-label="More TVs"><Icon name="plus" size={18} /></button>
            </div>
          </div>
          <dl className="mt-6 space-y-2 border-t border-line pt-5 text-sm">
            <div className="flex justify-between"><dt className="text-ink-muted">{tvs} × {money(q.unit)}</dt><dd className="tabular-nums">{money(q.subtotal)}</dd></div>
            {q.bulk && <div className="flex justify-between text-maroon"><dt>Multi-TV discount (15%)</dt><dd className="tabular-nums">-{money(q.discount)}</dd></div>}
            <div className="flex items-baseline justify-between pt-2"><dt className="font-semibold">This month</dt><dd className="font-display text-3xl font-semibold text-forest tabular-nums">{money(q.total)}</dd></div>
            <div className="flex justify-between text-xs text-ink-muted"><dt>First 12 months, estimated</dt><dd className="tabular-nums">{money(year)}</dd></div>
            {server && Number(server.total) !== q.total && <p className="text-xs text-warning">Your account's price is {money(Number(server.total))}. That's what you'd be charged.</p>}
          </dl>
          {tvs < 5 && <p className="mt-3 text-xs text-ink-muted">Add {5 - tvs} more TV{5 - tvs > 1 ? "s" : ""} to get 15% off everything.</p>}
          <div className="mt-6 space-y-3">
            <Button size="lg" className="w-full" disabled icon="phone">Pay with M-Pesa · coming soon</Button>
            <a className="kb-btn kb-btn--secondary kb-btn--lg w-full" href={waLink(wa, msg)} target="_blank" rel="noreferrer"><WhatsAppIcon size={20} />Upgrade on WhatsApp</a>
            <p className="text-center text-xs text-ink-muted">In-app M-Pesa and card payment is on the way. Until then we switch your account on as soon as you pay by M-Pesa to our till.</p>
          </div>
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
