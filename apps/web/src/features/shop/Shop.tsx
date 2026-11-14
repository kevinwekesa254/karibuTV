// Karibu TV shop: streaming sticks that run the welcome-screen app, delivered across Nairobi,
// with an optional setup visit. Orders are priced by the database (place_order), never the browser.
import { Fragment, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { track } from "@/lib/analytics";
import { CONFIG } from "@/lib/config";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { supabase, errorMessage } from "@/lib/supabase";
import { BRAND, waLink } from "@/lib/brand";
import { phoneValid, splitPhone } from "@/lib/countries";
import { Logo } from "@/components/Logo";
import { Icon, WhatsAppIcon } from "@/components/Icons";
import { PhoneInput } from "@/components/PhoneInput";
import { Button, Field, Input, PageLoader, Textarea } from "@/components/ui";
import { useCart } from "./cart";

export interface Product {
  id: string; slug: string; name: string; brand: string; tagline: string; description: string;
  highlights: string[]; specs: [string, string][]; in_box: string[]; images: string[];
  price_kes: number; compare_at_kes: number | null; stock: number; badge: string; karibu_ready: boolean; sort: number;
}
interface Zone { id: string; name: string; areas: string; fee_kes: number; eta: string; setup_available: boolean; setup_fee_kes: number; sort: number }
interface ShopSettings { mpesa_till: string; mpesa_name: string; whatsapp: string }

const kes = (n: number) => `KES ${n.toLocaleString("en-KE")}`;
const EASE = [0.16, 1, 0.3, 1] as const;

function useShopData() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [settings, setSettings] = useState<ShopSettings>({ mpesa_till: "", mpesa_name: BRAND.name, whatsapp: BRAND.supportWhatsApp });
  useEffect(() => {
    supabase.from("products").select("*").eq("active", true).order("sort").then(({ data }) => setProducts((data as Product[]) || []));
    supabase.from("delivery_zones").select("*").eq("active", true).order("sort").then(({ data }) => setZones((data as Zone[]) || []));
    supabase.from("app_settings").select("value").eq("key", "shop").maybeSingle().then(({ data }) => { if (data?.value) setSettings((s) => ({ ...s, ...(data.value as ShopSettings) })); });
  }, []);
  return { products, zones, settings };
}

// ------------------------------------------------------------- chrome
function ShopHeader({ onCart }: { onCart: () => void }) {
  const { count } = useCart();
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-white/90 backdrop-blur-md">
      <div className="kb-kikoi kb-kikoi--thin" />
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
        <div className="flex items-center gap-3"><Logo /><span className="hidden rounded-full bg-mint-soft px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-maroon sm:inline">Shop</span></div>
        <nav className="hidden items-center gap-7 text-[0.9375rem] font-medium text-ink/80 md:flex" aria-label="Shop">
          <Link to="/shop" className="hover:text-maroon">All devices</Link>
          <a href="/shop#help" className="hover:text-maroon">Which one?</a>
          <a href="/shop#delivery" className="hover:text-maroon">Delivery and setup</a>
          <Link to="/" className="hover:text-maroon">Karibu TV app</Link>
        </nav>
        <button onClick={onCart} className="relative flex h-11 items-center gap-2 rounded-full border border-line px-4 text-sm font-semibold hover:border-ink" aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}>
          <Icon name="bag" size={16} />Cart
          {count > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-maroon px-1 text-[11px] font-bold text-white">{count}</span>}
        </button>
      </div>
    </header>
  );
}

function CartDrawer({ open, onClose, products }: { open: boolean; onClose: () => void; products: Product[] }) {
  const { lines, setQty, remove } = useCart();
  const nav = useNavigate();
  const rows = lines.map((l) => ({ l, p: products.find((x) => x.id === l.product_id) })).filter((r) => r.p) as { l: { product_id: string; qty: number }; p: Product }[];
  const subtotal = rows.reduce((n, r) => n + r.p.price_kes * r.l.qty, 0);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Your cart">
          <motion.div className="absolute inset-0 bg-navy/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-panel"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: 0.45, ease: EASE }}>
            <div className="flex items-center justify-between border-b border-line px-6 py-5">
              <p className="font-display text-xl font-semibold text-navy">Your cart</p>
              <button onClick={onClose} className="rounded-full p-2 hover:bg-surface-wash" aria-label="Close cart"><Icon name="x" /></button>
            </div>
            {rows.length ? (
              <>
                <ul className="flex-1 divide-y divide-line overflow-y-auto px-6">
                  {rows.map(({ l, p }) => (
                    <li key={p.id} className="flex gap-4 py-5">
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-surface-wash"><img src={p.images[0]} alt="" className="h-full w-full object-contain p-1.5" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold leading-snug">{p.name}</p>
                        <p className="text-sm text-ink-muted">{kes(p.price_kes)}</p>
                        <div className="mt-2 flex items-center gap-3">
                          <Stepper value={l.qty} max={Math.min(10, p.stock)} onChange={(q) => setQty(p.id, q)} />
                          <button onClick={() => remove(p.id)} className="text-sm text-ink-muted underline hover:text-danger">Remove</button>
                        </div>
                      </div>
                      <p className="font-semibold tabular-nums">{kes(p.price_kes * l.qty)}</p>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-line p-6">
                  <div className="flex items-center justify-between font-semibold"><span>Subtotal</span><span className="tabular-nums">{kes(subtotal)}</span></div>
                  <p className="mt-1 text-sm text-ink-muted">Delivery and optional setup are added at checkout.</p>
                  <Button size="lg" variant="sun" className="mt-5 w-full" onClick={() => { onClose(); nav("/shop/checkout"); }}>Checkout</Button>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-mint-soft text-maroon"><Icon name="bag" size={22} /></span>
                <p className="mt-4 font-display text-lg font-semibold">Your cart is empty</p>
                <Button variant="secondary" className="mt-5" onClick={onClose}>Keep shopping</Button>
              </div>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

function Stepper({ value, onChange, max = 10 }: { value: number; onChange: (n: number) => void; max?: number }) {
  return (
    <div className="inline-flex items-center rounded-full border border-line">
      <button type="button" onClick={() => onChange(value - 1)} className="flex h-9 w-9 items-center justify-center rounded-full text-lg hover:bg-surface-wash disabled:opacity-30" aria-label="Decrease quantity" disabled={value <= 1}>-</button>
      <span className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-wash disabled:opacity-30" aria-label="Increase quantity" disabled={value >= max}><Icon name="plus" size={14} /></button>
    </div>
  );
}

function ShopShell({ children, products }: { children: ReactNode; products: Product[] }) {
  const [cartOpen, setCartOpen] = useState(false);
  useEffect(() => {
    const open = () => setCartOpen(true);
    window.addEventListener("karibu-open-cart", open);
    return () => window.removeEventListener("karibu-open-cart", open);
  }, []);
  return (
    <div className="min-h-[100dvh] bg-white">
      <ShopHeader onCart={() => setCartOpen(true)} />
      <main>{children}</main>
      <ShopFooter />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} products={products} />
    </div>
  );
}
const openCart = () => window.dispatchEvent(new Event("karibu-open-cart"));

function ShopFooter() {
  return (
    <footer className="mt-20 bg-navy text-bone">
      <div className="kb-kikoi" />
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-[1.5fr_1fr_1fr] sm:px-8">
        <div><Logo light /><p className="mt-3 max-w-sm text-sm text-bone/60">Streaming sticks that run the Karibu TV welcome screen, delivered and set up across Nairobi.</p></div>
        <div className="space-y-2 text-sm"><p className="font-semibold">Shop</p><Link to="/shop" className="block text-bone/70 hover:text-bone">All devices</Link><a href="/shop#delivery" className="block text-bone/70 hover:text-bone">Delivery and setup</a><Link to="/" className="block text-bone/70 hover:text-bone">The Karibu TV app</Link></div>
        <div className="space-y-2 text-sm"><p className="font-semibold">Help</p><a href={waLink(BRAND.supportWhatsApp, "Hi! I have a question about the Karibu TV shop.")} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-bone/70 hover:text-bone"><WhatsAppIcon size={15} />WhatsApp</a><a href={`mailto:${BRAND.email}`} className="block text-bone/70 hover:text-bone">{BRAND.email}</a></div>
      </div>
      <p className="mx-auto max-w-7xl px-4 pb-10 text-xs text-bone/45 sm:px-8">© {new Date().getFullYear()} {BRAND.name}. Google, Chromecast and Google TV are trademarks of Google LLC. Amazon and Fire TV are trademarks of Amazon.com, Inc.</p>
    </footer>
  );
}

// ------------------------------------------------------------- catalogue
function ProductCard({ p, i }: { p: Product; i: number }) {
  const { add } = useCart();
  const reduce = useReducedMotion();
  const soldOut = p.stock <= 0;
  return (
    <motion.article initial={reduce ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, delay: i * 0.05, ease: EASE }} className="group flex flex-col">
      <Link to={`/shop/${p.slug}`} className="relative block aspect-square overflow-hidden rounded-[20px] bg-surface-wash">
        <img src={p.images[0]} alt={p.name} loading="lazy" className="h-full w-full object-contain p-8 transition-transform duration-700 ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.06]" />
        {p.images[1] && <img src={p.images[1]} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain p-8 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {p.badge && <span className="rounded-full bg-maroon px-2.5 py-1 text-[11px] font-bold text-white">{p.badge}</span>}
          {soldOut && <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-white">Sold out</span>}
        </div>
      </Link>
      <div className="mt-4 flex flex-1 flex-col">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{p.brand}</p>
        <Link to={`/shop/${p.slug}`} className="mt-1 font-display text-lg font-semibold leading-snug text-navy hover:text-maroon">{p.name}</Link>
        <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{p.tagline}</p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <p className="font-semibold tabular-nums">{kes(p.price_kes)}{p.compare_at_kes && p.compare_at_kes > p.price_kes && <span className="ml-2 text-sm font-normal text-ink-muted line-through">{kes(p.compare_at_kes)}</span>}</p>
          <button disabled={soldOut} onClick={() => { add(p.id); openCart(); }}
            className="flex h-10 items-center gap-1.5 rounded-full bg-navy px-4 text-sm font-semibold text-white transition-colors hover:bg-maroon disabled:bg-line disabled:text-ink-muted" aria-label={`Add ${p.name} to cart`}>
            <Icon name="plus" size={14} />Add
          </button>
        </div>
      </div>
    </motion.article>
  );
}

function Helper({ products }: { products: Product[] }) {
  const [tv, setTv] = useState<"" | "android" | "samsung" | "old">("");
  const [need, setNeed] = useState<"" | "best" | "value">("");
  const pick = useMemo(() => {
    if (!tv || !need) return null;
    const slug = tv === "android" ? null : need === "best" ? "google-tv-streamer" : tv === "old" ? "chromecast-hd" : "chromecast-4k";
    return slug ? products.find((p) => p.slug === slug) : null;
  }, [tv, need, products]);
  const opt = (on: boolean) => `rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${on ? "border-navy bg-navy text-white" : "border-line hover:border-ink"}`;
  return (
    <section id="help" className="scroll-mt-24 rounded-[24px] bg-surface-wash p-6 sm:p-10">
      <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <h2 className="font-display text-[clamp(1.6rem,3vw,2.4rem)] font-semibold leading-tight text-navy">Which stick do I need?</h2>
          <p className="mt-2 text-ink-muted">Two quick questions.</p>
          <p className="mt-6 text-sm font-semibold">What TV is it?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className={opt(tv === "android")} onClick={() => setTv("android")}>Android or Google TV</button>
            <button className={opt(tv === "samsung")} onClick={() => setTv("samsung")}>Samsung, LG or other smart TV</button>
            <button className={opt(tv === "old")} onClick={() => setTv("old")}>Older TV with HDMI</button>
          </div>
          <p className="mt-5 text-sm font-semibold">What matters most?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className={opt(need === "best")} onClick={() => setNeed("best")}>Smoothest, always-on</button>
            <button className={opt(need === "value")} onClick={() => setNeed("value")}>Best value</button>
          </div>
        </div>
        <div className="min-h-[180px] rounded-[20px] bg-white p-6 shadow-card">
          {!tv || !need ? <p className="text-ink-muted">Your recommendation appears here.</p>
            : tv === "android" ? (
              <div>
                <p className="font-display text-xl font-semibold text-navy">You don't need a stick.</p>
                <p className="mt-2 text-ink-muted">Android and Google TVs run Karibu TV directly. Install it with the free Downloader app.</p>
                <Link to="/signup" className="kb-btn kb-btn--secondary kb-btn--md mt-4">Start free</Link>
              </div>
            ) : pick ? (
              <div className="flex gap-5">
                <img src={pick.images[0]} alt="" className="h-28 w-28 shrink-0 rounded-md bg-surface-wash object-contain p-2" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-maroon">We recommend</p>
                  <p className="font-display text-xl font-semibold text-navy">{pick.name}</p>
                  <p className="mt-1 text-sm text-ink-muted">{pick.tagline}</p>
                  <Link to={`/shop/${pick.slug}`} className="kb-btn kb-btn--sun kb-btn--md mt-4">See it · {kes(pick.price_kes)}</Link>
                </div>
              </div>
            ) : <p className="text-ink-muted">Loading…</p>}
        </div>
      </div>
    </section>
  );
}

function DeliveryInfo({ zones }: { zones: Zone[] }) {
  return (
    <section id="delivery" className="scroll-mt-24">
      <h2 className="font-display text-[clamp(1.6rem,3vw,2.4rem)] font-semibold leading-tight text-navy">Delivery and setup across Nairobi</h2>
      <p className="mt-2 max-w-2xl text-ink-muted">Choose delivery only, or add a setup visit: we bring the stick, install Karibu TV, pair it to your property and check the welcome screen with you.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {zones.map((z) => (
          <div key={z.id} className="rounded-[20px] border border-line p-6">
            <p className="font-display text-lg font-semibold text-navy">{z.name}</p>
            <p className="mt-1 text-sm text-ink-muted">{z.areas}</p>
            <dl className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink-muted">Delivery</dt><dd className="font-semibold tabular-nums">{kes(z.fee_kes)}</dd></div>
              {z.setup_available && <div className="flex justify-between"><dt className="text-ink-muted">Setup visit</dt><dd className="font-semibold tabular-nums">+ {kes(z.setup_fee_kes)}</dd></div>}
              <div className="flex justify-between"><dt className="text-ink-muted">When</dt><dd className="text-right font-semibold">{z.eta}</dd></div>
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}

const TRUST = [
  { icon: "check", title: "Genuine devices", body: "Sealed retail units from Google and Amazon." },
  { icon: "tv", title: "Karibu TV ready", body: "Every stick here runs the welcome-screen app." },
  { icon: "truck", title: "Nairobi delivery", body: "Same day in the city, next day around it." },
  { icon: "card", title: "M-Pesa or on delivery", body: "Pay to our till, or cash and M-Pesa at the door." },
];

export default function Shop() {
  const { products, zones } = useShopData();
  const [brand, setBrand] = useState("All");
  const reduce = useReducedMotion();
  useEffect(() => { document.title = "Shop · Karibu TV"; }, []);
  const brands = ["All", ...Array.from(new Set((products || []).map((p) => p.brand)))];
  const list = (products || []).filter((p) => brand === "All" || p.brand === brand);
  return (
    <ShopShell products={products || []}>
      <section className="relative overflow-hidden px-4 pb-10 pt-12 sm:px-8 sm:pt-16">
        <div aria-hidden className="kb-kitenge-panel pointer-events-none absolute -right-20 top-0 hidden h-full w-[34%] opacity-[0.07] lg:block" />
        <div className="relative mx-auto max-w-7xl">
          <motion.h1 initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE }}
            className="max-w-3xl font-display text-[clamp(2.4rem,5.5vw,4.4rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-navy">
            Turn any TV into a <span className="text-maroon">Karibu TV.</span>
          </motion.h1>
          <motion.p initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.2 }} className="mt-5 max-w-xl text-lg text-ink-muted">
            Streaming sticks that run the welcome screen, delivered across Nairobi. Add a setup visit and we'll install everything for you.
          </motion.p>
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="grid grid-cols-2 gap-3 border-y border-line py-6 md:grid-cols-4">
          {TRUST.map((t) => (
            <div key={t.title} className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mint-soft text-maroon"><Icon name={t.icon} size={16} /></span>
              <div><p className="text-sm font-semibold">{t.title}</p><p className="text-xs text-ink-muted">{t.body}</p></div>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Brand">
            {brands.map((b) => <button key={b} role="radio" aria-checked={brand === b} onClick={() => setBrand(b)} className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${brand === b ? "border-navy bg-navy text-white" : "border-line hover:border-ink"}`}>{b}</button>)}
          </div>
          <p className="text-sm text-ink-muted">{list.length} device{list.length === 1 ? "" : "s"}</p>
        </div>
        {products === null ? <PageLoader /> : list.length ? (
          <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">{list.map((p, i) => <ProductCard key={p.id} p={p} i={i} />)}</div>
        ) : <p className="mt-10 text-ink-muted">The shop is being stocked. WhatsApp us to order today.</p>}
        <div className="mt-20 space-y-20">
          <Helper products={products || []} />
          <DeliveryInfo zones={zones} />
        </div>
      </div>
    </ShopShell>
  );
}

// ------------------------------------------------------------- product page
export function ProductPage() {
  const { slug = "" } = useParams();
  const { products, zones } = useShopData();
  const { add } = useCart();
  const nav = useNavigate();
  const [img, setImg] = useState(0);
  const [qty, setQty] = useState(1);
  const p = products?.find((x) => x.slug === slug);
  useEffect(() => { if (p) document.title = `${p.name} · Karibu TV Shop`; setImg(0); setQty(1); }, [p]);
  if (products === null) return <ShopShell products={[]}><PageLoader /></ShopShell>;
  if (!p) return <ShopShell products={products}><div className="mx-auto max-w-xl px-4 py-24 text-center"><p className="font-display text-2xl font-semibold">That product isn't available.</p><Link to="/shop" className="kb-btn kb-btn--secondary kb-btn--md mt-6">Back to the shop</Link></div></ShopShell>;
  const soldOut = p.stock <= 0;
  const cheapest = zones.length ? Math.min(...zones.map((z) => z.fee_kes)) : null;
  const related = products.filter((x) => x.id !== p.id).slice(0, 3);
  return (
    <ShopShell products={products}>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-12">
        <nav aria-label="Breadcrumb" className="text-sm text-ink-muted"><Link to="/shop" className="hover:text-ink">Shop</Link> / <span className="text-ink">{p.name}</span></nav>
        <div className="mt-6 grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div>
            <div className="relative aspect-square overflow-hidden rounded-[24px] bg-surface-wash">
              <AnimatePresence mode="wait">
                <motion.img key={img} src={p.images[img]} alt={p.name} className="absolute inset-0 h-full w-full object-contain p-10"
                  initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease: EASE }} />
              </AnimatePresence>
              {p.badge && <span className="absolute left-4 top-4 rounded-full bg-maroon px-3 py-1 text-xs font-bold text-white">{p.badge}</span>}
            </div>
            {p.images.length > 1 && (
              <div className="mt-3 grid grid-cols-5 gap-3" role="tablist" aria-label="Product images">
                {p.images.map((src, i) => (
                  <button key={src} role="tab" aria-selected={img === i} onClick={() => setImg(i)}
                    className={`aspect-square overflow-hidden rounded-md border-2 bg-surface-wash ${img === i ? "border-navy" : "border-transparent hover:border-line-strong"}`}>
                    <img src={src} alt={`${p.name} image ${i + 1}`} className="h-full w-full object-contain p-1.5" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="lg:sticky lg:top-24 lg:self-start">
            <p className="text-sm font-semibold uppercase tracking-wider text-ink-muted">{p.brand}</p>
            <h1 className="mt-2 font-display text-[clamp(1.9rem,3.5vw,2.75rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-navy">{p.name}</h1>
            <p className="mt-3 text-lg text-ink-muted">{p.tagline}</p>
            <p className="mt-6 font-display text-3xl font-semibold tabular-nums">{kes(p.price_kes)}{p.compare_at_kes && p.compare_at_kes > p.price_kes && <span className="ml-3 text-lg font-normal text-ink-muted line-through">{kes(p.compare_at_kes)}</span>}</p>
            <p className={`mt-2 flex items-center gap-2 text-sm font-semibold ${soldOut ? "text-danger" : p.stock <= 3 ? "text-warning" : "text-[#1a7f43]"}`}>
              <span className={`h-2 w-2 rounded-full ${soldOut ? "bg-danger" : p.stock <= 3 ? "bg-warning" : "bg-[#1a7f43]"}`} />
              {soldOut ? "Sold out" : p.stock <= 3 ? `Only ${p.stock} left` : "In stock, ready to deliver"}
            </p>
            {p.karibu_ready && <p className="mt-5 flex items-start gap-3 rounded-md bg-mint-soft p-4 text-sm"><Icon name="tv" size={18} className="mt-0.5 text-maroon" /><span><b>Karibu TV ready.</b> Runs the welcome-screen app. Add a setup visit at checkout and we'll install and pair it for you.</span></p>}
            <ul className="mt-6 space-y-2.5">{p.highlights.map((h) => <li key={h} className="flex gap-3 text-[0.9375rem]"><Icon name="check" size={16} className="mt-1 text-maroon" />{h}</li>)}</ul>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Stepper value={qty} onChange={setQty} max={Math.max(1, Math.min(10, p.stock))} />
              <Button size="lg" variant="secondary" disabled={soldOut} onClick={() => { add(p.id, qty); openCart(); }} className="flex-1">Add to cart</Button>
            </div>
            <Button size="lg" variant="sun" disabled={soldOut} className="mt-3 w-full" onClick={() => { add(p.id, qty); nav("/shop/checkout"); }}>Buy now</Button>
            <p className="mt-4 text-sm text-ink-muted">{cheapest !== null ? `Delivery across Nairobi from ${kes(cheapest)}. ` : ""}Pay by M-Pesa or on delivery.</p>
            <div className="mt-8 divide-y divide-line border-y border-line">
              <Disclosure title="About this device" open><p className="text-ink-muted">{p.description}</p></Disclosure>
              {p.specs.length > 0 && <Disclosure title="Specifications"><dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-2 text-sm">{p.specs.map(([k, v]) => <Fragment key={k}><dt className="text-ink-muted">{k}</dt><dd>{v}</dd></Fragment>)}</dl></Disclosure>}
              {p.in_box.length > 0 && <Disclosure title="In the box"><ul className="list-inside list-disc text-sm text-ink-muted">{p.in_box.map((x) => <li key={x}>{x}</li>)}</ul></Disclosure>}
              <Disclosure title="Delivery and setup">
                <ul className="space-y-2 text-sm">{zones.map((z) => <li key={z.id} className="flex justify-between gap-4"><span><b>{z.name}</b><span className="block text-ink-muted">{z.eta}</span></span><span className="text-right tabular-nums">{kes(z.fee_kes)}{z.setup_available && <span className="block text-ink-muted">setup + {kes(z.setup_fee_kes)}</span>}</span></li>)}</ul>
              </Disclosure>
            </div>
          </div>
        </div>
        {related.length > 0 && (
          <section className="mt-24">
            <h2 className="font-display text-2xl font-semibold text-navy">You might also like</h2>
            <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-3">{related.map((x, i) => <ProductCard key={x.id} p={x} i={i} />)}</div>
          </section>
        )}
      </div>
    </ShopShell>
  );
}

function Disclosure({ title, children, open }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">{title}<Icon name="chevron-down" size={16} className="transition-transform group-open:rotate-180" /></summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

// ------------------------------------------------------------- checkout
/** Paystack checkout link for an order, or null (the order page then offers to try again). */
async function startOrderPayment(number: number, token: string): Promise<string | null> {
  const { data } = await supabase.functions.invoke("paystack", { body: { action: "order", number, token } });
  return (data as { url?: string } | null)?.url || null;
}
type Fulfilment = "delivery" | "delivery_setup";
type Pay = "paystack" | "mpesa_till" | "cod" | "whatsapp";

export function Checkout() {
  const { products, zones, settings } = useShopData();
  const { lines, clear } = useCart();
  const nav = useNavigate();
  const [f, setF] = useState({ name: "", phone: "", email: "", zone_id: "", address: "", note: "", mpesa_code: "" });
  const [fulfilment, setFulfilment] = useState<Fulfilment>("delivery");
  const [pay, setPay] = useState<Pay>(CONFIG.payments_enabled ? "paystack" : "mpesa_till");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { document.title = "Checkout · Karibu TV Shop"; }, []);
  useEffect(() => { if (!f.zone_id && zones[0]) setF((x) => ({ ...x, zone_id: zones[0].id })); }, [zones, f.zone_id]);
  const rows = lines.map((l) => ({ l, p: products?.find((x) => x.id === l.product_id) })).filter((r) => r.p) as { l: { product_id: string; qty: number }; p: Product }[];
  const zone = zones.find((z) => z.id === f.zone_id);
  const subtotal = rows.reduce((n, r) => n + r.p.price_kes * r.l.qty, 0);
  const setup = fulfilment === "delivery_setup" && zone?.setup_available ? zone.setup_fee_kes : 0;
  const total = subtotal + (zone?.fee_kes || 0) + setup;
  const sp = splitPhone(f.phone);
  const errs = {
    name: f.name.trim().length < 2 ? "Add your name." : "",
    phone: !phoneValid(sp.country, sp.local) ? "Add a phone number we can call." : "",
    address: f.address.trim().length < 3 ? "Tell us where to deliver." : "",
    zone: !zone ? "Choose an area." : "",
    email: pay === "paystack" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim()) ? "Add your email to pay online. Your receipt goes there." : "",
  };
  const valid = !Object.values(errs).some(Boolean) && rows.length > 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setTouched(true); setError("");
    if (!valid) return;
    setBusy(true);
    try {
      const { data, error: err } = await supabase.rpc("place_order", { p: {
        name: f.name.trim(), phone: f.phone, email: f.email.trim(), zone_id: f.zone_id, address: f.address.trim(), note: f.note.trim(),
        fulfilment, payment_method: pay, mpesa_code: f.mpesa_code.trim(), items: rows.map((r) => ({ product_id: r.p.id, qty: r.l.qty })),
      } });
      if (err) throw err;
      const o = data as { number: number; token: string; total_kes: number };
      clear();
      track("begin_checkout", { currency: "KES", value: total, item_category: "shop", payment: pay });
      if (pay === "paystack") {
        const url = await startOrderPayment(o.number, o.token);
        if (url) { window.location.href = url; return; }
      }
      if (pay === "whatsapp") {
        const msg = `Hi! I've placed order #${o.number} on the Karibu TV shop (${kes(o.total_kes)}). ${rows.map((r) => `${r.l.qty}x ${r.p.name}`).join(", ")}. Delivery: ${zone?.name}${setup ? " with setup" : ""}.`;
        window.open(waLink(settings.whatsapp || BRAND.supportWhatsApp, msg), "_blank", "noopener");
      }
      nav(`/shop/order/${o.number}?t=${o.token}`, { replace: true });
    } catch (err) { setError(errorMessage(err).replace(/^rate_limited:\s*/, "")); } finally { setBusy(false); }
  };

  const radio = (on: boolean) => `flex w-full items-start gap-3 rounded-md border-2 p-4 text-left transition-colors ${on ? "border-navy bg-surface-wash" : "border-line hover:border-line-strong"}`;
  const dot = (on: boolean) => <span className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-navy" : "border-line-strong"}`}>{on && <span className="h-2 w-2 rounded-full bg-navy" />}</span>;

  if (products === null) return <ShopShell products={[]}><PageLoader /></ShopShell>;
  if (!rows.length) return <ShopShell products={products}><div className="mx-auto max-w-xl px-4 py-24 text-center"><p className="font-display text-2xl font-semibold">Your cart is empty.</p><Link to="/shop" className="kb-btn kb-btn--sun kb-btn--md mt-6">Browse devices</Link></div></ShopShell>;
  return (
    <ShopShell products={products}>
      <form onSubmit={submit} noValidate className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-8 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-10">
          <h1 className="font-display text-3xl font-semibold text-navy">Checkout</h1>
          {error && <p role="alert" className="rounded-md bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
          <section className="space-y-4">
            <h2 className="font-display text-lg font-semibold">Contact</h2>
            <Field label="Full name" error={touched ? errs.name : ""}>{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" maxLength={80} />}</Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone (for delivery)" error={touched ? errs.phone : ""}>{(id) => <PhoneInput id={id} value={f.phone} onChange={(v) => setF((x) => ({ ...x, phone: v }))} invalid={touched && !!errs.phone} />}</Field>
              <Field label="Email" optional={pay !== "paystack"} error={touched ? errs.email : ""}>{(id) => <Input id={id} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" maxLength={120} />}</Field>
            </div>
          </section>
          <section className="space-y-4">
            <h2 className="font-display text-lg font-semibold">Delivery</h2>
            <div className="space-y-2" role="radiogroup" aria-label="Delivery area">
              {zones.map((z) => (
                <button key={z.id} type="button" role="radio" aria-checked={f.zone_id === z.id} onClick={() => setF({ ...f, zone_id: z.id })} className={radio(f.zone_id === z.id)}>
                  {dot(f.zone_id === z.id)}
                  <span className="min-w-0 flex-1"><span className="block font-semibold">{z.name}</span><span className="block text-sm text-ink-muted">{z.areas}</span><span className="block text-xs text-ink-muted">{z.eta}</span></span>
                  <span className="font-semibold tabular-nums">{kes(z.fee_kes)}</span>
                </button>
              ))}
            </div>
            <Field label="Delivery address" error={touched ? errs.address : ""} hint="Estate, building, house number and a landmark.">{(id, d) => <Textarea id={id} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} rows={2} maxLength={300} aria-describedby={d} />}</Field>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Setup">
              <button type="button" role="radio" aria-checked={fulfilment === "delivery"} onClick={() => setFulfilment("delivery")} className={radio(fulfilment === "delivery")}>
                {dot(fulfilment === "delivery")}<span><span className="block font-semibold">Delivery only</span><span className="block text-sm text-ink-muted">I'll install the app myself.</span></span>
              </button>
              <button type="button" role="radio" aria-checked={fulfilment === "delivery_setup"} disabled={!zone?.setup_available} onClick={() => setFulfilment("delivery_setup")} className={`${radio(fulfilment === "delivery_setup")} disabled:opacity-50`}>
                {dot(fulfilment === "delivery_setup")}<span className="flex-1"><span className="block font-semibold">Delivery and setup</span><span className="block text-sm text-ink-muted">We install Karibu TV and pair it.</span></span>
                {zone?.setup_available && <span className="text-sm font-semibold tabular-nums">+{kes(zone.setup_fee_kes)}</span>}
              </button>
            </div>
          </section>
          <section className="space-y-4">
            <h2 className="font-display text-lg font-semibold">Payment</h2>
            <div className="space-y-2" role="radiogroup" aria-label="Payment">
              {CONFIG.payments_enabled && <button type="button" role="radio" aria-checked={pay === "paystack"} onClick={() => setPay("paystack")} className={radio(pay === "paystack")}>
                {dot(pay === "paystack")}<span><span className="block font-semibold">Pay now: M-Pesa or card</span><span className="block text-sm text-ink-muted">Secure checkout by Paystack. Your order is confirmed straight away.</span></span>
              </button>}
              <button type="button" role="radio" aria-checked={pay === "mpesa_till"} onClick={() => setPay("mpesa_till")} className={radio(pay === "mpesa_till")}>
                {dot(pay === "mpesa_till")}<span><span className="block font-semibold">M-Pesa to our till</span><span className="block text-sm text-ink-muted">Pay to our till now. We confirm and dispatch.</span></span>
              </button>
              {pay === "mpesa_till" && (
                <div className="rounded-md bg-mint-soft p-4 text-sm">
                  {settings.mpesa_till ? <p>Go to M-Pesa, <b>Lipa na M-Pesa → Buy Goods</b>, till number <b className="font-display text-lg">{settings.mpesa_till}</b> ({settings.mpesa_name}), amount <b>{kes(total)}</b>.</p>
                    : <p>We'll send you the till number by SMS or WhatsApp right after you order.</p>}
                  <Field label="M-Pesa code" optional className="mt-3" hint="Paste it if you've already paid, e.g. QK12AB34CD.">{(id, d) => <Input id={id} value={f.mpesa_code} onChange={(e) => setF({ ...f, mpesa_code: e.target.value.toUpperCase() })} maxLength={20} aria-describedby={d} />}</Field>
                </div>
              )}
              <button type="button" role="radio" aria-checked={pay === "cod"} onClick={() => setPay("cod")} className={radio(pay === "cod")}>
                {dot(pay === "cod")}<span><span className="block font-semibold">Pay on delivery</span><span className="block text-sm text-ink-muted">M-Pesa or cash when the stick arrives.</span></span>
              </button>
              <button type="button" role="radio" aria-checked={pay === "whatsapp"} onClick={() => setPay("whatsapp")} className={radio(pay === "whatsapp")}>
                {dot(pay === "whatsapp")}<span><span className="block font-semibold">Order on WhatsApp</span><span className="block text-sm text-ink-muted">We'll confirm details and payment with you in chat.</span></span>
              </button>
            </div>
            <Field label="Note for us" optional>{(id) => <Input id={id} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={500} placeholder="e.g. Call when you reach the gate" />}</Field>
          </section>
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[20px] bg-surface-wash p-6">
            <h2 className="font-display text-lg font-semibold">Order summary</h2>
            <ul className="mt-4 space-y-4">
              {rows.map(({ l, p }) => (
                <li key={p.id} className="flex items-center gap-3">
                  <span className="relative h-16 w-16 shrink-0 rounded-md bg-white"><img src={p.images[0]} alt="" className="h-full w-full object-contain p-1.5" /><span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[11px] font-bold text-white">{l.qty}</span></span>
                  <span className="min-w-0 flex-1 text-sm font-semibold">{p.name}</span>
                  <span className="text-sm tabular-nums">{kes(p.price_kes * l.qty)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-6 space-y-2 border-t border-line pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-ink-muted">Subtotal</dt><dd className="tabular-nums">{kes(subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-muted">Delivery{zone ? ` (${zone.name})` : ""}</dt><dd className="tabular-nums">{zone ? kes(zone.fee_kes) : "-"}</dd></div>
              {setup > 0 && <div className="flex justify-between"><dt className="text-ink-muted">Setup visit</dt><dd className="tabular-nums">{kes(setup)}</dd></div>}
              <div className="flex items-baseline justify-between border-t border-line pt-3"><dt className="font-semibold">Total</dt><dd className="font-display text-2xl font-semibold tabular-nums">{kes(total)}</dd></div>
            </dl>
            <Button type="submit" size="lg" variant="sun" className="mt-6 w-full" loading={busy}>{pay === "whatsapp" ? "Place order and open WhatsApp" : pay === "paystack" ? `Pay ${kes(total)}` : "Place order"}</Button>
            <p className="mt-3 text-center text-xs text-ink-muted">Prices include VAT. Final amount is confirmed when we receive your order.</p>
          </div>
        </aside>
      </form>
    </ShopShell>
  );
}

// ------------------------------------------------------------- confirmation
interface Order { number: number; name: string; status: string; total_kes: number; subtotal_kes: number; delivery_kes: number; setup_kes: number; items: { name: string; qty: number; price_kes: number; image: string }[]; payment_method: Pay; fulfilment: Fulfilment; zone_name: string; address: string; created_at: string }
const STEPS = [["new", "Received"], ["paid", "Paid"], ["packed", "Packed"], ["dispatched", "On the way"], ["delivered", "Delivered"]];

export function OrderConfirmed() {
  const { number = "" } = useParams();
  const [params] = useSearchParams();
  const { products, settings } = useShopData();
  const [o, setO] = useState<Order | null | undefined>(undefined);
  const [paying, setPaying] = useState(false);
  const [checking, setChecking] = useState(!!(params.get("reference") || params.get("trxref")));
  const token = params.get("t") || "";
  const load = () => supabase.rpc("order_lookup", { p_number: Number(number), p_token: token }).then(({ data }) => setO((data as Order) || null));
  useEffect(() => {
    const ref = params.get("reference") || params.get("trxref");
    if (!ref) { load(); return; }
    // Back from Paystack: confirm with the server, then show the order.
    (async () => {
      for (let i = 0; i < 5; i++) {
        const { data } = await supabase.functions.invoke("paystack", { body: { action: "verify", reference: ref } });
        const r = data as { ok?: boolean; status?: string } | null;
        if (r?.ok) track("purchase", { transaction_id: ref, currency: "KES", item_category: "shop" });
        if (r?.ok || (r?.status && !["ongoing", "pending", "processing", "queued"].includes(r.status))) break;
        await new Promise((res) => setTimeout(res, 4000));
      }
      setChecking(false);
      load();
    })();
  }, [number, token]);
  const payNow = async () => {
    setPaying(true);
    const url = await startOrderPayment(Number(number), token);
    if (url) { window.location.href = url; return; }
    setPaying(false);
    alert("Payment couldn't start. Try again, or WhatsApp us.");
  };
  if (o === undefined || checking) return <ShopShell products={products || []}><PageLoader /></ShopShell>;
  if (o === null) return <ShopShell products={products || []}><div className="mx-auto max-w-xl px-4 py-24 text-center"><p className="font-display text-2xl font-semibold">We couldn't find that order.</p><p className="mt-2 text-ink-muted">Use the link from your confirmation, or WhatsApp us your order number.</p></div></ShopShell>;
  const stepIndex = o.status === "awaiting_payment" ? 0 : Math.max(0, STEPS.findIndex(([k]) => k === o.status));
  return (
    <ShopShell products={products || []}>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-8">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-maroon text-white"><Icon name="check" size={26} /></span>
        <h1 className="mt-5 font-display text-3xl font-semibold text-navy">Thank you, {o.name.split(" ")[0]}. Order #{o.number} is in.</h1>
        <p className="mt-2 text-ink-muted">Keep this page. We'll call you on the number you gave us to arrange delivery{o.fulfilment === "delivery_setup" ? " and the setup visit" : ""}.</p>
        {o.status !== "cancelled" ? (
          <ol className="mt-8 grid grid-cols-5 gap-2" aria-label="Order progress">
            {STEPS.map(([k, label], i) => (
              <li key={k} className="text-center">
                <span className={`mx-auto block h-1.5 rounded-full ${i <= stepIndex ? "bg-maroon" : "bg-line"}`} />
                <span className={`mt-2 block text-xs font-semibold ${i <= stepIndex ? "text-ink" : "text-ink-muted"}`}>{label}</span>
              </li>
            ))}
          </ol>
        ) : <p className="mt-8 rounded-md bg-danger/10 p-4 font-semibold text-danger">This order was cancelled.</p>}
        {o.payment_method === "paystack" && o.status === "awaiting_payment" && (
          <div className="mt-8 rounded-[20px] bg-mint-soft p-6">
            <p className="font-display text-lg font-semibold">Payment not received yet</p>
            <p className="mt-2">Pay {kes(o.total_kes)} by M-Pesa or card to confirm your order. If you just paid, give it a minute and refresh.</p>
            <Button className="mt-4" icon="card" loading={paying} onClick={payNow}>Pay {kes(o.total_kes)} now</Button>
          </div>
        )}
        {o.payment_method === "paystack" && o.status === "paid" && <p className="mt-8 rounded-md bg-mint-soft p-4 font-semibold">Paid. We've emailed your receipt and will call you to arrange delivery.</p>}
        {o.payment_method === "mpesa_till" && o.status === "awaiting_payment" && (
          <div className="mt-8 rounded-[20px] bg-mint-soft p-6">
            <p className="font-display text-lg font-semibold">Pay with M-Pesa</p>
            {settings.mpesa_till ? <p className="mt-2">Lipa na M-Pesa → Buy Goods → till <b className="font-display text-xl">{settings.mpesa_till}</b> → amount <b>{kes(o.total_kes)}</b>. We confirm payments within the hour during working hours.</p>
              : <p className="mt-2">We'll send the till number to your phone shortly.</p>}
          </div>
        )}
        <div className="mt-8 rounded-[20px] border border-line p-6">
          <ul className="space-y-3">{o.items.map((it) => <li key={it.name} className="flex items-center gap-3"><img src={it.image} alt="" className="h-12 w-12 rounded bg-surface-wash object-contain p-1" /><span className="flex-1 text-sm font-semibold">{it.qty} × {it.name}</span><span className="text-sm tabular-nums">{kes(it.price_kes * it.qty)}</span></li>)}</ul>
          <dl className="mt-5 space-y-1.5 border-t border-line pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-ink-muted">Delivery ({o.zone_name})</dt><dd>{kes(o.delivery_kes)}</dd></div>
            {o.setup_kes > 0 && <div className="flex justify-between"><dt className="text-ink-muted">Setup visit</dt><dd>{kes(o.setup_kes)}</dd></div>}
            <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{kes(o.total_kes)}</dd></div>
          </dl>
          <p className="mt-4 text-sm text-ink-muted">Deliver to: {o.address}</p>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <a className="kb-btn kb-btn--secondary kb-btn--md" href={waLink(settings.whatsapp || BRAND.supportWhatsApp, `Hi! About my order #${o.number}.`)} target="_blank" rel="noreferrer"><WhatsAppIcon size={16} />Questions? WhatsApp us</a>
          <Link to="/signup" className="kb-btn kb-btn--sun kb-btn--md">Set up your welcome screen</Link>
        </div>
      </div>
    </ShopShell>
  );
}
