import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useConfig } from "@/lib/config";
import { BRAND, waLink } from "@/lib/brand";
import { samplePayload } from "@/lib/samples";
import type { ScreenPayload } from "@/lib/types";
import { Logo } from "@/components/Logo";
import { Icon, WhatsAppIcon } from "@/components/Icons";
import { Button, ButtonLink, Eyebrow, Field, Input, Select, Textarea } from "@/components/ui";
import { RoomMockup } from "@/features/tv/WelcomeScreen";
import { supabase } from "@/lib/supabase";

const TV_BRANDS = ["TCL", "Hisense", "Vitron", "Skyworth", "Syinix", "Sony", "Xiaomi", "Samsung", "LG", "other"];
const SETUP_VIDEO_ID = ""; // YouTube id of the setup video, once recorded

function PhoneMock() {
  return (
    <div className="w-[170px] rounded-[28px] border-[6px] border-[#111] bg-surface shadow-panel sm:w-[200px]">
      <div className="space-y-2 p-3 text-[10px]">
        <div className="flex items-center justify-between"><span className="font-display text-xs font-semibold text-forest">Casa Mara</span><span className="kb-tag !text-[9px]">PRO</span></div>
        <div className="rounded-lg bg-mint p-2.5">
          <p className="font-semibold uppercase tracking-wider text-forest">Today</p>
          <p className="font-display text-sm font-semibold">Priya arrives today</p>
        </div>
        {[["Wanjiru", "14–17 Nov"], ["Tom", "18–20 Nov"], ["Guest name missing", "22–25 Nov"]].map(([n, d]) => (
          <div key={n} className="flex items-center gap-2 rounded-lg border border-line p-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-mint-soft font-semibold text-forest">{n[0]}</span>
            <span className="flex-1"><b className="block">{n}</b><span className="text-ink-muted">{d}</span></span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 rounded-lg border border-line p-2"><span className="h-2 w-2 rounded-full bg-[#12b76a]" />Living room TV · Online</div>
      </div>
    </div>
  );
}

function Section({ id, children, className = "" }: { id?: string; children: ReactNode; className?: string }) {
  return <section id={id} className={`scroll-mt-20 px-4 py-20 sm:px-8 sm:py-28 ${className}`}><div className="mx-auto max-w-6xl">{children}</div></section>;
}

function Header() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const links = [["Features", "#features"], ["How it works", "#how"], ["Pricing", "#pricing"], ["FAQ", "#faq"]];
  return (
    <header className="sticky top-0 z-40 bg-mint">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <Logo />
        <nav className="hidden items-center gap-7 md:flex" aria-label="Main">
          {links.map(([l, h]) => <a key={h} href={h} className="text-[0.9375rem] font-semibold text-on-mint hover:underline">{l}</a>)}
        </nav>
        <div className="flex items-center gap-2">
          {user ? <ButtonLink to="/app" size="sm">Open dashboard</ButtonLink> : (
            <>
              <Link to="/signin" className="kb-btn kb-btn--ghost kb-btn--sm hidden sm:inline-flex">Log in</Link>
              <ButtonLink to="/signup" size="sm">Start free</ButtonLink>
            </>
          )}
          <button className="rounded-full p-2 md:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Menu"><Icon name={open ? "x" : "menu"} /></button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-forest/10 px-4 pb-4 md:hidden" aria-label="Mobile">
          {links.map(([l, h]) => <a key={h} href={h} onClick={() => setOpen(false)} className="block py-3 font-semibold text-on-mint">{l}</a>)}
          {!user && <Link to="/signin" className="block py-3 font-semibold text-on-mint">Log in</Link>}
        </nav>
      )}
    </header>
  );
}

function Hero() {
  const p = samplePayload({ property: { layout: "minimal", theme: "karibu" } });
  return (
    <section className="kb-band rounded-b-band px-4 pb-20 pt-10 sm:px-8 sm:pb-28 sm:pt-16">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1fr_1.15fr]">
        <div>
          <Eyebrow className="!text-forest">For Airbnb and holiday-rental hosts</Eyebrow>
          <h1 className="mt-4 font-display text-display-xl text-forest">Your TV says karibu to every guest.</h1>
          <p className="mt-5 max-w-xl text-lg text-on-mint/80">Greet guests by name, share Wi-Fi in one scan and show house rules before anyone asks.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink to="/signup" size="lg">Start free</ButtonLink>
            <a href="#how" className="kb-btn kb-btn--secondary kb-btn--lg">See how it works</a>
          </div>
          <p className="mt-6 text-sm text-on-mint/70">Works on Android TV and Google TV: TCL, Hisense, Vitron, Skyworth, Syinix, Sony, Xiaomi</p>
        </div>
        <div className="relative sm:pb-20">
          <RoomMockup payload={p} className="shadow-panel sm:ml-auto sm:w-[92%]" />
          <div className="absolute bottom-0 left-0 hidden origin-bottom-left scale-[.72] sm:block lg:-left-4"><PhoneMock /></div>
        </div>
      </div>
    </section>
  );
}

function Problem() {
  const msgs = [
    ["guest", "Hi! What's the Wi-Fi password? 🙏", "10:52 pm"],
    ["guest", "Also the gate code isn't working", "10:53 pm"],
    ["guest", "And what time is check-out tomorrow?", "11:04 pm"],
  ];
  return (
    <Section>
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-display-md text-forest">Every guest asks the same questions. Usually at 11 pm.</h2>
          <p className="mt-4 text-lg text-ink-muted">Wi-Fi, check-out time, where the towels go. You answer them on WhatsApp again and again. Karibu TV puts the answers on the biggest screen in the house, ready the moment guests walk in.</p>
        </div>
        <div className="mx-auto w-full max-w-sm rounded-lg bg-[#efeae2] p-4 shadow-card">
          <div className="mb-3 flex items-center gap-2 border-b border-black/10 pb-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25d366] text-white"><WhatsAppIcon size={18} /></span><span className="font-semibold">Guest · Casa Mara</span></div>
          <div className="space-y-2">
            {msgs.map(([, t, time]) => (
              <div key={t} className="max-w-[85%] rounded-lg rounded-tl-none bg-white px-3 py-2 text-sm shadow-sm">{t}<span className="ml-2 text-[10px] text-ink-muted">{time}</span></div>
            ))}
            <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-2 text-sm shadow-sm">It's all on the TV 😊<span className="ml-2 text-[10px] text-ink-muted">11:05 pm</span></div>
          </div>
        </div>
      </div>
    </Section>
  );
}

function Features() {
  const f = [
    ["guests", "Greets every guest by name", "“Welcome, Priya!” on arrival day, from your bookings. Guests feel expected."],
    ["wifi", "Wi-Fi in one scan", "A QR code on the TV joins phones to your Wi-Fi. No passwords spelled out on WhatsApp."],
    ["door", "Smooth check-outs", "On departure day the screen lists your check-out steps and the time."],
    ["calendar", "Follows your Airbnb calendar", "Link Airbnb, Booking.com or Vrbo and bookings appear by themselves."],
    ["phone", "Run it from your phone", "Change the Wi-Fi password or rules on your phone. The TV updates in seconds."],
    ["offline", "Works offline", "When the power or internet drops, the TV comes back on and keeps showing the last screen."],
  ];
  return (
    <Section id="features" className="bg-surface-wash">
      <Eyebrow>Features</Eyebrow>
      <h2 className="mt-3 max-w-2xl font-display text-display-md text-forest">Everything guests ask, answered on the big screen.</h2>
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {f.map(([icon, title, body]) => (
          <div key={title} className="kb-card p-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-md bg-mint text-on-mint"><Icon name={icon} size={24} /></span>
            <h3 className="mt-5 font-display text-xl font-semibold text-forest">{title}</h3>
            <p className="mt-2 text-ink-muted">{body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function HowItWorks() {
  const steps = [
    ["Install the app on the TV", "Download Karibu TV on any Android TV or Google TV in a couple of minutes."],
    ["Pair with a 6-letter code", "The TV shows a code. Type it on your phone and pick the room."],
    ["Guests feel at home", "The screen switches by itself: welcome, check-out day, and between guests."],
  ];
  return (
    <Section id="how">
      <Eyebrow>How it works</Eyebrow>
      <h2 className="mt-3 font-display text-display-md text-forest">Set up in under 10 minutes.</h2>
      <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_1.2fr]">
        <ol className="space-y-8">
          {steps.map(([t, b], i) => (
            <li key={t} className="flex gap-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-forest font-display text-xl font-semibold text-mint">{i + 1}</span>
              <div><h3 className="font-display text-xl font-semibold text-forest">{t}</h3><p className="mt-1 text-ink-muted">{b}</p></div>
            </li>
          ))}
        </ol>
        <div className="aspect-video overflow-hidden rounded-lg bg-forest shadow-panel">
          {SETUP_VIDEO_ID ? (
            <iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${SETUP_VIDEO_ID}`} title="Karibu TV setup video" loading="lazy"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-mint">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-mint text-forest"><Icon name="play" size={28} /></span>
              <p className="font-display text-lg font-semibold">Setup video coming soon</p>
              <a className="text-sm underline" href={waLink(BRAND.supportWhatsApp, "Hi! Can you walk me through setting up Karibu TV?")} target="_blank" rel="noreferrer">Or get a setup call on WhatsApp</a>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

function Showcase() {
  const slides: { label: string; p: ScreenPayload }[] = [
    { label: "During the stay · Classic layout · Maroon & gold", p: samplePayload({ property: { layout: "classic", theme: "maroon" } }) },
    { label: "Check-out day · Minimal layout · Midnight", p: samplePayload({ state: "checkout", property: { layout: "minimal", theme: "midnight" } }) },
    { label: "No booking · Mirror layout · Deep teal", p: samplePayload({ state: "between", stay: null, property: { layout: "mirror", theme: "teal", generic_note: "2-bed · Ocean view · Fast Wi-Fi" } }) },
    { label: "During the stay · Minimal layout · Karibu", p: samplePayload({ property: { layout: "minimal", theme: "karibu" } }) },
    { label: "Free plan · Spotlight layout · Charcoal", p: samplePayload({ plan: { pro: false, branded: true, logo: false, weather: false }, weather: null, property: { layout: "spotlight", theme: "charcoal" } }) },
  ];
  const [i, setI] = useState(0);
  return (
    <Section className="bg-surface-wash">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Layouts and themes</Eyebrow>
          <h2 className="mt-3 font-display text-display-md text-forest">Make it look like your place.</h2>
          <p className="mt-2 text-ink-muted">Five layouts, nine colour themes and your own photos and logo.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setI((x) => (x + slides.length - 1) % slides.length)} aria-label="Previous"><Icon name="chevron-left" size={18} /></Button>
          <Button variant="secondary" size="sm" onClick={() => setI((x) => (x + 1) % slides.length)} aria-label="Next"><Icon name="chevron-right" size={18} /></Button>
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-4xl">
        <RoomMockup payload={slides[i].p} className="shadow-panel" />
        <p className="mt-4 text-center font-semibold text-ink" aria-live="polite">{slides[i].label}</p>
        <div className="mt-3 flex justify-center gap-2">
          {slides.map((s, j) => <button key={s.label} onClick={() => setI(j)} aria-label={s.label} aria-current={i === j} className={`h-2.5 rounded-full transition-all ${i === j ? "w-8 bg-forest" : "w-2.5 bg-forest/25"}`} />)}
        </div>
      </div>
    </Section>
  );
}

function Integrations() {
  return (
    <section className="kb-band--soft rounded-t-band-xl px-4 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl text-center">
        <Eyebrow>Calendar sync</Eyebrow>
        <h2 className="mt-3 font-display text-display-md text-forest">Bookings from where you already take them.</h2>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {["Airbnb", "Booking.com", "Vrbo", "Google Calendar", "Any PMS with iCal"].map((n) => (
            <span key={n} className="rounded-full bg-surface px-6 py-3 font-display text-lg font-semibold text-forest shadow-card">{n}</span>
          ))}
        </div>
        <p className="mt-6 text-ink-muted">Using a property-management system? <a className="font-semibold text-green underline" href={waLink(BRAND.supportWhatsApp, "Hi! Does Karibu TV work with my PMS?")} target="_blank" rel="noreferrer">Ask for your PMS</a></p>
      </div>
    </section>
  );
}

function Pricing() {
  const cfg = useConfig();
  const [cur, setCur] = useState<"KES" | "USD">("KES");
  const price = (n: number) => (cur === "KES" ? `KES ${n.toLocaleString()}` : `$${n}`);
  const rows: [string, ReactNode, ReactNode][] = [
    ["TVs", "1", "Per TV, as many as you need"],
    ["Properties", "1", "Up to 50"],
    ["Wi-Fi QR, house rules, check-out steps", "✓", "✓"],
    ["Greets guests by name", "✓", "✓"],
    ["Live updates and offline mode", "✓", "✓"],
    ["Airbnb / Booking.com / Vrbo calendar sync", "—", "✓"],
    ["Your logo, no Karibu TV badge", "—", "✓"],
    ["Weather forecast", "—", "✓"],
  ];
  return (
    <Section id="pricing">
      <div className="text-center">
        <Eyebrow>Pricing</Eyebrow>
        <h2 className="mt-3 font-display text-display-md text-forest">Start free. Upgrade per TV.</h2>
        <div className="mt-6 inline-flex rounded-full border border-line p-1" role="radiogroup" aria-label="Currency">
          {(["KES", "USD"] as const).map((c) => <button key={c} role="radio" aria-checked={cur === c} onClick={() => setCur(c)} className={`rounded-full px-5 py-1.5 text-sm font-semibold ${cur === c ? "bg-ink text-on-ink" : ""}`}>{c}</button>)}
        </div>
      </div>
      <div className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-2">
        <div className="kb-card flex flex-col p-7">
          <h3 className="font-display text-2xl font-semibold text-forest">Free</h3>
          <p className="mt-1 text-ink-muted">For trying it on one TV.</p>
          <p className="mt-6 font-display text-5xl font-semibold text-ink">{price(0)}</p>
          <p className="text-sm text-ink-muted">forever</p>
          <ul className="mt-6 flex-1 space-y-2 text-sm">{["1 TV, 1 property", "Guest names, Wi-Fi QR, rules", "Small Karibu TV badge on screen"].map((x) => <li key={x} className="flex gap-2"><Icon name="check" size={18} className="text-green" />{x}</li>)}</ul>
          <ButtonLink to="/signup" variant="secondary" size="lg" className="mt-8">Start free</ButtonLink>
        </div>
        <div className="kb-card relative flex flex-col border-2 !border-forest p-7">
          {cfg.founding_offer.active && <span className="kb-tag absolute -top-3 left-7 !bg-mint">{cfg.founding_offer.label}</span>}
          <h3 className="font-display text-2xl font-semibold text-forest">Pro</h3>
          <p className="mt-1 text-ink-muted">For hosts with bookings every week.</p>
          <p className="mt-6 font-display text-5xl font-semibold text-ink">{price(cfg.prices[cur].month)}</p>
          <p className="text-sm text-ink-muted">per TV / month · or {price(cfg.prices[cur].year)} per year</p>
          <ul className="mt-6 flex-1 space-y-2 text-sm">{["Calendar sync with Airbnb, Booking.com, Vrbo", "Your logo, no badge", "Weather, up to 50 properties"].map((x) => <li key={x} className="flex gap-2"><Icon name="check" size={18} className="text-green" />{x}</li>)}</ul>
          <ButtonLink to="/signup" size="lg" className="mt-8">Start free, upgrade later</ButtonLink>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-4xl overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead><tr className="border-b-2 border-forest"><th className="py-3 font-semibold">Compare</th><th className="w-28 py-3 text-center font-semibold">Free</th><th className="w-48 py-3 text-center font-semibold">Pro</th></tr></thead>
          <tbody>{rows.map(([a, b, c]) => <tr key={a} className="border-b border-line"><td className="py-3">{a}</td><td className="py-3 text-center">{b}</td><td className="py-3 text-center">{c}</td></tr>)}</tbody>
        </table>
        <p className="mt-6 text-center text-ink-muted">5+ TVs? <a className="font-semibold text-green underline" href={waLink(BRAND.supportWhatsApp, "Hi! I have 5+ TVs and want to talk about Karibu TV pricing.")} target="_blank" rel="noreferrer">Talk to us on WhatsApp</a></p>
      </div>
    </Section>
  );
}

const FAQ: [string, string][] = [
  ["Which TVs does it work on?", "Any Android TV or Google TV: TCL, Hisense, Vitron, Skyworth, Syinix, Sony, Xiaomi and Chromecast with Google TV. For other TVs, a Google TV stick works. Samsung and LG apps are on the way."],
  ["Do guests need to install anything?", "No. Guests just look at the TV. To join the Wi-Fi they point their phone camera at the QR code."],
  ["Where do guest names come from?", "You type the first name when you add a booking. With Pro, bookings come in from your Airbnb, Booking.com or Vrbo calendar and you just add the name."],
  ["What if I change the Wi-Fi password?", "Change it in the dashboard on your phone. The TV updates within seconds."],
  ["What if the internet or power goes?", "The TV starts Karibu by itself when it turns back on and shows the last screen it had, even without internet. It catches up when the connection returns."],
  ["What do you keep about guests?", "Only the first name and stay dates. We delete them 30 days after check-out. Your private notes never appear on the TV."],
  ["How do I pay?", "The Free plan needs no payment. Pro is paid per TV by M-Pesa in Kenya or by card elsewhere."],
];

function Faq() {
  return (
    <Section id="faq" className="bg-surface-wash">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="mt-3 font-display text-display-md text-forest">Questions hosts ask.</h2>
        </div>
        <div className="divide-y divide-line border-y border-line">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-semibold text-forest">
                {q}<Icon name="plus" className="shrink-0 transition-transform group-open:rotate-45" />
              </summary>
              <p className="mt-3 text-ink-muted">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}

function LeadForm() {
  const [f, setF] = useState({ name: "", email: "", whatsapp: "", city: "", tv_brand: "TCL", tv_count: "1", message: "", website: "" });
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.name.trim() || (!f.whatsapp.trim() && !f.email.trim())) { setError("Add your name and a WhatsApp number or email so we can reach you."); return; }
    setState("sending"); setError("");
    try {
      const params = new URLSearchParams(window.location.search);
      const source = ["utm_source", "utm_medium", "utm_campaign"].map((k) => params.get(k)).filter(Boolean).join("/");
      if (f.website) { setState("done"); return; } // honeypot: pretend success
      const { error: err } = await supabase.from("leads").insert({
        name: f.name.trim().slice(0, 80), email: f.email.trim().slice(0, 120), whatsapp: f.whatsapp.trim().slice(0, 20),
        city: f.city.trim().slice(0, 60), tv_brand: f.tv_brand, tv_count: Math.max(0, Math.min(999, parseInt(f.tv_count, 10) || 0)),
        message: f.message.trim().slice(0, 1000), source: source.slice(0, 200),
      });
      if (err) throw new Error("Couldn't send. Try WhatsApp instead.");
      setState("done");
    } catch (err) { setError((err as Error).message); setState("idle"); }
  };
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <Section id="contact">
      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <Eyebrow>Get set up</Eyebrow>
          <h2 className="mt-3 font-display text-display-md text-forest">Want help setting it up?</h2>
          <p className="mt-3 text-lg text-ink-muted">Tell us about your place and TVs. We'll WhatsApp you the setup steps, and can walk you through it on a call.</p>
          <a className="kb-btn kb-btn--secondary kb-btn--md mt-6" href={waLink(BRAND.supportWhatsApp, "Hi! I'm interested in Karibu TV.")} target="_blank" rel="noreferrer"><WhatsAppIcon size={18} />Chat on WhatsApp</a>
        </div>
        <div className="kb-card p-6 sm:p-8">
          {state === "done" ? (
            <div className="py-10 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-mint text-forest"><Icon name="check" size={28} /></span>
              <p className="mt-4 font-display text-2xl font-semibold text-forest">Thanks! We'll WhatsApp you the setup steps.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
              {error && <p role="alert" className="kb-error sm:col-span-2">{error}</p>}
              <Field label="Name">{(id) => <Input id={id} value={f.name} onChange={set("name")} autoComplete="name" />}</Field>
              <Field label="WhatsApp">{(id) => <Input id={id} type="tel" value={f.whatsapp} onChange={set("whatsapp")} autoComplete="tel" placeholder="+254…" />}</Field>
              <Field label="Email" optional>{(id) => <Input id={id} type="email" value={f.email} onChange={set("email")} autoComplete="email" />}</Field>
              <Field label="City" optional>{(id) => <Input id={id} value={f.city} onChange={set("city")} placeholder="Diani, Nairobi…" />}</Field>
              <Field label="TV brand">{(id) => <Select id={id} value={f.tv_brand} onChange={set("tv_brand")}>{TV_BRANDS.map((b) => <option key={b} value={b}>{b === "other" ? "Other" : b}</option>)}</Select>}</Field>
              <Field label="Number of TVs">{(id) => <Input id={id} type="number" min={1} value={f.tv_count} onChange={set("tv_count")} />}</Field>
              <Field label="Message" optional className="sm:col-span-2">{(id) => <Textarea id={id} value={f.message} onChange={set("message")} rows={3} />}</Field>
              <input type="text" name="website" value={f.website} onChange={set("website")} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
              <Button type="submit" size="lg" loading={state === "sending"} className="sm:col-span-2">Send</Button>
            </form>
          )}
        </div>
      </div>
    </Section>
  );
}

function Closing() {
  return (
    <section className="kb-band rounded-t-band-xl px-4 py-20 text-center sm:px-8 sm:py-28">
      <h2 className="font-display text-display-lg text-forest">Ready to say karibu?</h2>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink to="/signup" size="lg">Start free</ButtonLink>
        <a className="kb-btn kb-btn--secondary kb-btn--lg" href={waLink(BRAND.supportWhatsApp, "Hi! I'd like to book a Karibu TV setup call.")} target="_blank" rel="noreferrer">Book a setup call</a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-surface-wash px-4 py-12 sm:px-8">
      <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div><Logo /><p className="mt-3 text-sm text-ink-muted">Made in Kenya 🇰🇪</p></div>
        <div className="space-y-2 text-sm"><p className="font-semibold">Product</p><a href="#features" className="block text-ink-muted hover:text-ink">Features</a><a href="#pricing" className="block text-ink-muted hover:text-ink">Pricing</a><a href="#faq" className="block text-ink-muted hover:text-ink">FAQ</a></div>
        <div className="space-y-2 text-sm"><p className="font-semibold">Legal</p><Link to="/privacy" className="block text-ink-muted hover:text-ink">Privacy</Link><Link to="/terms" className="block text-ink-muted hover:text-ink">Terms</Link></div>
        <div className="space-y-2 text-sm"><p className="font-semibold">Contact</p><a href={waLink(BRAND.supportWhatsApp)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-ink-muted hover:text-ink"><WhatsAppIcon size={16} />WhatsApp</a><a href={`mailto:${BRAND.email}`} className="block text-ink-muted hover:text-ink">{BRAND.email}</a></div>
      </div>
      <p className="mx-auto mt-10 max-w-6xl text-xs text-ink-muted">© {new Date().getFullYear()} {BRAND.name}</p>
    </footer>
  );
}

function JsonLd() {
  useEffect(() => {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.text = JSON.stringify([
      { "@context": "https://schema.org", "@type": "SoftwareApplication", name: BRAND.name, applicationCategory: "BusinessApplication", operatingSystem: "Android TV, Google TV, Web",
        offers: [{ "@type": "Offer", price: "0", priceCurrency: "KES", name: "Free" }, { "@type": "Offer", price: "500", priceCurrency: "KES", name: "Pro (per TV per month)" }] },
      { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    ]);
    document.head.appendChild(el);
    return () => el.remove();
  }, []);
  return null;
}

export default function Landing() {
  return (
    <div className="bg-surface">
      <JsonLd />
      <Header />
      <main>
        <Hero />
        <Problem />
        <Features />
        <HowItWorks />
        <Showcase />
        <Integrations />
        <Pricing />
        <Faq />
        <LeadForm />
        <Closing />
      </main>
      <Footer />
    </div>
  );
}
