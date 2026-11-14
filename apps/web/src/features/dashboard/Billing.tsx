import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { useSearchParams } from "react-router-dom";
import { useToast } from "@/lib/toast";
import { errorMessage } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { paymentsOn } from "@/lib/config";
import { BRAND, waLink } from "@/lib/brand";
import { fmtDateLong } from "@/lib/dates";
import type { Payment } from "@/lib/types";
import { Icon, WhatsAppIcon } from "@/components/Icons";
import { Button, Card, PageHeader, Segmented, Tag } from "@/components/ui";
import { useData } from "./data";
import { PRO_FEATURES } from "./shared/UpgradeSheet";
import { formatMoney, price, PRICING, type Currency } from "@/lib/pricing";

export default function Billing() {
  const { user, profile, plan, refreshProfile } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [months, setMonths] = useState<"1" | "12">("1");
  const [paying, setPaying] = useState(false);
  const [checking, setChecking] = useState(false);
  const { devices, properties } = useData();
  const [currency, setCurrency] = useState<Currency>(profile?.country === "KE" || !profile?.country ? "KES" : "USD");
  const paired = devices.filter((d) => d.property_id).length;
  const [tvs, setTvs] = useState(Math.max(1, paired, plan.pro ? plan.maxTvs : 1));
  const [payments, setPayments] = useState<Payment[]>([]);
  const loadPayments = () => supabase.from("payments").select("*").neq("status", "cancelled").order("created_at", { ascending: false }).then(({ data }) => setPayments((data as Payment[]) || []));
  useEffect(() => { loadPayments(); }, []);

  // Back from Paystack: ?reference=KTVP... Ask the server to confirm with Paystack.
  const returned = useRef(false);
  useEffect(() => {
    const ref = params.get("reference") || params.get("trxref");
    if (!ref || returned.current) return;
    returned.current = true;
    setChecking(true);
    (async () => {
      for (let i = 0; i < 6; i++) {
        const { data } = await supabase.functions.invoke("paystack", { body: { action: "verify", reference: ref } });
        const r = data as { ok?: boolean; status?: string } | null;
        if (r?.ok) { track("purchase", { transaction_id: ref, currency: "KES", item_category: "pro" }); await refreshProfile(); toast("Payment received. Pro is on."); break; }
        if (r?.status && !["ongoing", "pending", "processing", "queued"].includes(r.status)) { toast("That payment didn't go through. You haven't been charged.", "error"); break; }
        await new Promise((res) => setTimeout(res, 4000));
      }
      setChecking(false);
      loadPayments();
      setParams({}, { replace: true });
    })();
  }, [params]);

  const money = (n: number) => formatMoney(n, currency);
  const m = Number(months);
  const shown = price(tvs, m, currency);
  const monthly = price(tvs, 1, currency), yearly = price(tvs, 12, currency);
  const payKes = price(tvs, m, "KES").total;
  const pay = async () => {
    setPaying(true);
    track("begin_checkout", { currency: "KES", value: payKes, item_category: "pro", months: m, tvs });
    const { data, error } = await supabase.functions.invoke("paystack", { body: { action: "plan", tvs, months: m } });
    const url = (data as { url?: string } | null)?.url;
    if (url) { window.location.href = url; return; }
    setPaying(false);
    let msg = errorMessage(error);
    try { msg = (await (error as { context?: Response }).context?.json())?.error || msg; } catch { /* keep msg */ }
    toast(msg || "Payment couldn't start. Try again.", "error");
  };
  const wa = BRAND.supportWhatsApp;
  const msg = `Hi! I'd like Karibu TV Pro for ${tvs} TV${tvs > 1 ? "s" : ""}, paid ${m === 12 ? "yearly" : "monthly"} (${money(shown.total)}). Account: ${user?.email}`;

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
            <h2 className="font-display text-xl font-semibold text-forest">{plan.pro && !plan.trial ? "Renew or add TVs" : "Upgrade to Pro"}</h2>
            <Segmented label="Currency" value={currency} onChange={setCurrency} size="sm" options={[{ value: "KES", label: "KES" }, { value: "USD", label: "USD" }]} />
          </div>
          <p className="mt-2 font-display text-3xl font-semibold text-forest">{money(PRICING.perTv[currency])}<span className="text-base font-normal text-ink-muted"> per TV a month</span></p>
          <p className="text-sm text-ink-muted">Pay yearly and get 2 months free.</p>
          <div className="mt-6 flex items-center justify-between gap-4">
            <p className="text-sm font-semibold text-ink">How many TVs?</p>
            <div className="flex items-center gap-1 rounded-full border border-line p-1">
              <button onClick={() => setTvs((n) => Math.max(1, n - 1))} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-mint-soft disabled:opacity-30" disabled={tvs <= 1} aria-label="Fewer TVs"><span className="text-xl leading-none">-</span></button>
              <span className="w-10 text-center font-display text-xl font-semibold tabular-nums" aria-live="polite">{tvs}</span>
              <button onClick={() => setTvs((n) => Math.min(500, n + 1))} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-mint-soft" aria-label="More TVs"><Icon name="plus" size={18} /></button>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="How often to pay">
            <button type="button" role="radio" aria-checked={m === 1} onClick={() => setMonths("1")} className={`flex w-full flex-col rounded-md border-2 p-4 text-left transition-colors ${m === 1 ? "border-maroon bg-mint-soft" : "border-line hover:border-line-strong"}`}>
              <span className="text-sm font-semibold">Monthly</span>
              <span className="mt-1 font-display text-2xl font-semibold tabular-nums">{money(monthly.total)}</span>
              <span className="text-xs text-ink-muted">a month</span>
            </button>
            <button type="button" role="radio" aria-checked={m === 12} onClick={() => setMonths("12")} className={`flex w-full flex-col rounded-md border-2 p-4 text-left transition-colors ${m === 12 ? "border-maroon bg-mint-soft" : "border-line hover:border-line-strong"}`}>
              <span className="flex items-center justify-between gap-2 text-sm font-semibold">Yearly <Tag>2 months free</Tag></span>
              <span className="mt-1 font-display text-2xl font-semibold tabular-nums">{money(yearly.total)}</span>
              <span className="text-xs text-ink-muted">a year · you save {money(yearly.saved)}</span>
            </button>
          </div>
          <p className="mt-4 text-sm text-ink-muted">{tvs} TV{tvs > 1 ? "s" : ""} × {money(PRICING.perTv[currency])}{m === 12 ? " × 10 months" : ""} = <b className="text-ink">{money(shown.total)}</b>{plan.pro && !plan.trial ? ", added on to your current Pro time." : "."}</p>
          {currency === "USD" && <p className="mt-1 text-xs text-ink-muted">Charged in Kenyan shillings ({formatMoney(payKes, "KES")}). Your card converts it.</p>}
          <div className="mt-5 space-y-3">
            {paymentsOn() ? <>
            <Button size="lg" className="w-full" icon="card" loading={paying || checking} onClick={pay}>{checking ? "Confirming your payment…" : `Pay ${formatMoney(payKes, "KES")} by M-Pesa or card`}</Button>
            <p className="text-center text-xs text-ink-muted">Secure checkout. Pro switches on the moment you pay, and we email your receipt.</p>
            <a className="kb-btn kb-btn--ghost kb-btn--md w-full" href={waLink(wa, msg)} target="_blank" rel="noreferrer"><WhatsAppIcon size={18} />Prefer to pay on WhatsApp?</a>
            </> : <>
            <a className="kb-btn kb-btn--primary kb-btn--lg w-full" href={waLink(wa, msg)} target="_blank" rel="noreferrer"><WhatsAppIcon size={20} />Upgrade on WhatsApp</a>
            <p className="text-center text-xs text-ink-muted">Paying by M-Pesa or card here is coming very soon. Until then we switch your account on as soon as you pay us on WhatsApp.</p>
            </>}
          </div>
        </Card>
      </div>

      <Card className="mt-5 overflow-hidden">
        <h2 className="border-b border-line px-5 py-4 font-display text-xl font-semibold text-forest">Payment history</h2>
        {payments?.length ? (
          <ul className="divide-y divide-line">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span>{fmtDateLong(p.created_at)} · {p.tvs} TV{p.tvs === 1 ? "" : "s"} · {p.months || 1} month{(p.months || 1) > 1 ? "s" : ""}{p.status === "paid" && p.receipt ? ` · ${p.receipt === "mobile_money" ? "M-Pesa" : p.receipt}` : ""}</span>
                <span className="flex items-center gap-2">{p.currency} {p.amount.toLocaleString()} <Tag tone={p.status === "paid" ? "mint" : p.status === "failed" ? "danger" : "muted"}>{p.status}</Tag></span>
              </li>
            ))}
          </ul>
        ) : <p className="px-5 py-6 text-sm text-ink-muted">No payments yet.</p>}
      </Card>
    </div>
  );
}
