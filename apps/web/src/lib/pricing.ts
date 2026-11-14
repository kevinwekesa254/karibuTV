// Karibu TV pricing. The one place prices are worked out in the app; the database function
// public.plan_price() mirrors it exactly and is what every payment is checked against.
//
// Rules
// 1. Free: 1 TV and 1 property, forever.
// 2. Pro: KES 499 (US$3.90) per TV per month.
// 3. Pay for 12 months: 2 months free (you pay for 10).
// KES rounds to whole shillings, USD to cents.

export type Currency = "KES" | "USD";

export const PRICING = {
  perTv: { KES: 499, USD: 3.9 } as Record<Currency, number>,
  yearlyFreeMonths: 2,
  maxTvs: 500,
} as const;

const minor = (c: Currency) => (c === "KES" ? 1 : 100);

export interface Price {
  currency: Currency; tvs: number; months: number;
  unit: number;      // per TV per month
  monthly: number;   // all TVs, one month
  freeMonths: number;
  total: number;     // what's charged for `months`
  saved: number;     // value of the free months
}

/** Price for `tvs` TVs over `months` months (1 = monthly, 12 = yearly with 2 months free). */
export function price(tvs: number, months = 1, currency: Currency = "KES"): Price {
  const n = Math.max(1, Math.min(PRICING.maxTvs, Math.floor(tvs) || 1));
  const m = Math.max(1, Math.min(24, Math.floor(months) || 1));
  const k = minor(currency);
  const unit = PRICING.perTv[currency];
  const monthlyMinor = Math.round(unit * k) * n;
  const freeMonths = Math.floor(m / 12) * PRICING.yearlyFreeMonths;
  return {
    currency, tvs: n, months: m, unit, monthly: monthlyMinor / k, freeMonths,
    total: (monthlyMinor * (m - freeMonths)) / k, saved: (monthlyMinor * freeMonths) / k,
  };
}

export const formatMoney = (n: number, c: Currency) =>
  c === "KES" ? `KES ${n.toLocaleString("en-KE")}` : `$${n.toFixed(2).replace(/\.00$/, "")}`;

/** "KES 499 per TV a month" */
export const priceLine = (c: Currency) => `${formatMoney(PRICING.perTv[c], c)} per TV a month`;
