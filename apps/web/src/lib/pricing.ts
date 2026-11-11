// Karibu TV pricing. The one place prices are calculated in the app; the database function
// public.price_quote() mirrors it exactly and is what a payment must be checked against.
//
// Rules
// 1. Pro is billed per TV per month.
// 2. Months 1-3 of a host's paid subscription: introductory price (KES 399 per TV).
//    From month 4: standard price (KES 499 per TV).
// 3. 5 or more TVs: 15% off the whole monthly bill.
// 4. KES rounds to whole shillings, USD to cents (half up).

export type Currency = "KES" | "USD";

export const PRICING = {
  introMonths: 3,
  perTv: { KES: { intro: 399, standard: 499 }, USD: { intro: 3.1, standard: 3.9 } } as Record<Currency, { intro: number; standard: number }>,
  bulk: { minTvs: 5, percent: 15 },
  maxTvs: 500,
} as const;

// All maths in minor units (shillings / cents) so it can't drift from the SQL version.
const minor = (c: Currency) => (c === "KES" ? 1 : 100);

export interface Quote {
  currency: Currency; tvs: number; month: number;
  unit: number; intro: boolean; subtotal: number; discount: number; total: number; bulk: boolean;
}

/** Price of one billing month. `month` is 1 for the first paid month. */
export function quote(tvs: number, month = 1, currency: Currency = "KES"): Quote {
  const n = Math.max(1, Math.min(PRICING.maxTvs, Math.floor(tvs) || 1));
  const m = Math.max(1, Math.floor(month) || 1);
  const intro = m <= PRICING.introMonths;
  const unit = PRICING.perTv[currency][intro ? "intro" : "standard"];
  const k = minor(currency);
  const subtotalMinor = Math.round(unit * k) * n;
  const bulk = n >= PRICING.bulk.minTvs;
  const discountMinor = bulk ? Math.round((subtotalMinor * PRICING.bulk.percent) / 100) : 0; // integer maths, half up
  return { currency, tvs: n, month: m, unit, intro, subtotal: subtotalMinor / k, discount: discountMinor / k, total: (subtotalMinor - discountMinor) / k, bulk };
}

/** Total for the first `months` months of a subscription (e.g. 12 for a first-year estimate). */
export function periodTotal(tvs: number, months: number, currency: Currency = "KES") {
  const k = minor(currency);
  let total = 0;
  for (let m = 1; m <= months; m++) total += Math.round(quote(tvs, m, currency).total * k);
  return total / k;
}

export const formatMoney = (n: number, c: Currency) =>
  c === "KES" ? `KES ${n.toLocaleString("en-KE")}` : `$${n.toFixed(2).replace(/\.00$/, "")}`;
