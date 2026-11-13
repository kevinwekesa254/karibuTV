// Landing page. Design read: product landing for East African holiday-rental hosts,
// kitenge brand (maroon + navy on cool white), Clash Display + Satoshi. Dials: variance 7, motion 6, density 4.
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { track } from "@/lib/analytics";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useAuth } from "@/lib/auth";
import { BRAND, waLink } from "@/lib/brand";
import { samplePayload } from "@/lib/samples";
import { TEMPLATES } from "@/lib/templates";
import { COUNTRIES } from "@/lib/countries";
import { formatMoney, quote, type Currency } from "@/lib/pricing";
import type { ScreenState } from "@/lib/types";
import { Logo } from "@/components/Logo";
import { Icon, WhatsAppIcon } from "@/components/Icons";
import { Flag, PhoneInput } from "@/components/PhoneInput";
import { Button, ButtonLink, Field, Input, Select, Textarea } from "@/components/ui";
import { RoomMockup, WelcomeScreen } from "@/features/tv/WelcomeScreen";
import { OtherTvs } from "@/features/dashboard/Tvs";
import { supabase } from "@/lib/supabase";
import { CONFIG } from "@/lib/config";

const EASE = [0.16, 1, 0.3, 1] as const;
const TV_BRANDS = ["TCL", "Hisense", "Vitron", "Skyworth", "Syinix", "Sony", "Xiaomi", "Samsung", "LG", "other"];
const PLACES = ["Diani", "Watamu", "Lamu", "Nanyuki", "Naivasha", "Kilimani", "Westlands", "Zanzibar", "Arusha", "Dar es Salaam", "Kigali", "Musanze", "Jinja", "Kampala", "Entebbe", "Malindi"];
const H2 = "font-display text-[clamp(2rem,4vw,3.25rem)] font-semibold leading-[1.05] tracking-[-0.02em] text-navy";

/** Fade-and-rise on scroll into view. Static under reduced motion. */
function Reveal({ children, delay = 0, className = "", y = 28 }: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} initial={reduce ? false : { opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }} transition={{ duration: 0.8, delay, ease: EASE }}>
      {children}
    </motion.div>
  );
}

/** Kitenge band between sections, after the maroon and navy wax print. */
function KitengeDivider() {
  return <div aria-hidden className="kb-kikoi !h-[18px]" />;
}

function Section({ id, children, className = "" }: { id?: string; children: ReactNode; className?: string }) {
  return <section id={id} className={`scroll-mt-20 px-4 py-14 sm:px-8 sm:py-20 ${className}`}><div className="mx-auto max-w-7xl">{children}</div></section>;
}

// ------------------------------------------------------------------ header
function Header() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const links = [["How it works", "#story"], ["Features", "#features"], ["Templates", "#templates"], ["Pricing", "#pricing"], ["Shop", "/shop"], ["TV app", "#download"], ["FAQ", "#faq"]];
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-white/85 backdrop-blur-md">
      <div className="kb-kikoi kb-kikoi--thin" />
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
        <Logo />
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Main">
          {links.map(([l, h]) => <a key={h} href={h} className="text-[0.9375rem] font-medium text-ink/80 transition-colors hover:text-maroon">{l}</a>)}
        </nav>
        <div className="flex items-center gap-2">
          {user ? <ButtonLink to="/app" size="sm" variant="sun">Open dashboard</ButtonLink> : (
            <>
              <Link to="/signin" className="kb-btn kb-btn--ghost kb-btn--sm hidden sm:inline-flex">Log in</Link>
              <ButtonLink to="/signup" size="sm" variant="sun">Start free</ButtonLink>
            </>
          )}
          <button className="rounded-full p-2 lg:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Menu"><Icon name={open ? "x" : "menu"} /></button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-line px-4 pb-4 lg:hidden" aria-label="Mobile">
          {links.map(([l, h]) => <a key={h} href={h} onClick={() => setOpen(false)} className="block py-3 font-semibold">{l}</a>)}
          {!user && <Link to="/signin" className="block py-3 font-semibold">Log in</Link>}
        </nav>
      )}
    </header>
  );
}

// ---------------------------------------------------- phone dashboard (real mini UI)
function PhoneDashboard() {
  return (
    <div className="flex h-full flex-col bg-[#f6f5f9] text-[#17182a]" style={{ fontSize: 10 }}>
      <div className="h-[9%] shrink-0" />
      <div className="flex items-center justify-between px-[7%]">
        <div><p className="text-[0.85em] text-[#5c5e70]">Good evening</p><p className="font-display text-[1.45em] font-semibold leading-tight">Amina</p></div>
        <span className="flex h-[2.6em] w-[2.6em] items-center justify-center rounded-full bg-[#7a1a2e] font-display text-[1.1em] font-semibold text-white">A</span>
      </div>
      <div className="mx-[6%] mt-[6%] overflow-hidden rounded-[1.3em] bg-[#17182a] text-white">
        <div className="h-[0.7em] bg-[url(/brand/kitenge-strip.svg)] bg-[length:auto_100%] bg-repeat-x" />
        <div className="p-[1.2em]">
          <p className="text-[0.8em] uppercase tracking-[0.14em] text-[#f3b0bd]">On the TV now</p>
          <p className="mt-[0.3em] font-display text-[1.35em] font-semibold leading-tight">Karibu, Christine!</p>
          <p className="mt-[0.3em] text-[0.85em] text-white/70">Casa Mara, Diani · 3 nights</p>
        </div>
      </div>
      <div className="mx-[6%] mt-[5%] grid grid-cols-2 gap-[0.7em]">
        {[["Guide scans", "12", "this week"], ["Review taps", "4", "this month"]].map(([a, b, c]) => (
          <div key={a} className="rounded-[1em] bg-white p-[1em] shadow-[0_1px_2px_rgba(23,24,42,.08)]">
            <p className="text-[0.8em] text-[#5c5e70]">{a}</p><p className="font-display text-[1.7em] font-semibold leading-none">{b}</p><p className="text-[0.75em] text-[#5c5e70]">{c}</p>
          </div>
        ))}
      </div>
      <div className="mx-[6%] mt-[5%] space-y-[0.6em]">
        {[["tv-signal", "Living room TV", "Online"], ["bedroom", "Bedroom TV", "Online"], ["broom", "Housekeeping", "Tue 10:00"]].map(([i, a, b]) => (
          <div key={a} className="flex items-center gap-[0.8em] rounded-[1em] bg-white p-[0.9em] shadow-[0_1px_2px_rgba(23,24,42,.08)]">
            <span className="flex h-[2.3em] w-[2.3em] items-center justify-center rounded-full bg-[#faf0f2] text-[#7a1a2e]"><Icon name={i} size={11} /></span>
            <span className="flex-1 font-semibold">{a}</span><span className="text-[0.85em] text-[#7a1a2e]">{b}</span>
          </div>
        ))}
      </div>
      <div className="mx-[6%] mt-[5%] rounded-[1em] border border-[#e7e5ec] bg-white p-[1em]">
        <p className="text-[0.8em] text-[#5c5e70]">Most visited pick</p>
        <p className="font-semibold">Ali Barbour's Cave</p>
      </div>
    </div>
  );
}

/** Your phone frame (public/mockups/phone-frame.png) with a live mini screen inside. */
function PhoneFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`} style={{ aspectRatio: "700 / 1436" }}>
      <div className="absolute overflow-hidden" style={{ left: "4.43%", top: "1.81%", width: "91.14%", height: "96.38%", borderRadius: "14% / 6.8%" }}>{children}</div>
      <img src="/mockups/phone-frame.png" alt="" className="pointer-events-none absolute inset-0 h-full w-full drop-shadow-[0_30px_40px_rgba(23,24,42,.35)]" />
    </div>
  );
}

// -------------------------------------------------------------------- hero
function Hero() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const phoneY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -80]);
  const tvY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 40]);
  const coast = TEMPLATES[0];
  const p = samplePayload({ property: { layout: coast.layout, theme: coast.theme, photo_url: coast.photo } });
  const words = ["Five-star", "stays", "start", "at", "the", "TV."];
  return (
    <section ref={ref} className="relative overflow-hidden bg-white px-4 pb-12 pt-10 sm:px-8 sm:pb-16 sm:pt-14">
      <div aria-hidden className="kb-kitenge-panel pointer-events-none absolute -right-24 top-0 hidden h-full w-[38%] opacity-[0.07] lg:block" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.95fr_1.25fr]">
        <div>
          <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}
            className="flex items-center gap-1.5" aria-label="Kenya, Tanzania, Uganda, Rwanda and more">
            {COUNTRIES.slice(0, 5).map((c) => <Flag key={c.code} code={c.flag} className="h-4 w-6" />)}
            <span className="ml-2 text-sm font-medium text-ink-muted">For hosts across East Africa</span>
          </motion.div>
          <h1 className="mt-6 font-display text-[clamp(2.7rem,6vw,4.9rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-navy">
            {words.map((w, i) => (
              <motion.span key={i} className={`mr-[0.22em] inline-block ${i >= 3 ? "text-maroon" : ""}`}
                initial={reduce ? false : { opacity: 0, y: "0.5em" }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 + i * 0.07, ease: EASE }}>
                {w}
              </motion.span>
            ))}
          </h1>
          <motion.p initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.6 }}
            className="mt-6 max-w-[34rem] text-lg leading-relaxed text-ink-muted">
            Your TV greets every guest by name, shares Wi-Fi in one scan, recommends your favourite spots and asks for the review.
          </motion.p>
          <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.75, ease: EASE }}
            className="mt-9 flex flex-wrap gap-3">
            <ButtonLink to="/signup" size="lg" variant="sun">Start free</ButtonLink>
            <a href="#story" className="kb-btn kb-btn--secondary kb-btn--lg"><Icon name="play" size={16} />See it in action</a>
          </motion.div>
        </div>
        <div className="relative pb-10 sm:pb-0">
          <motion.div style={{ y: tvY }} initial={reduce ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.1, delay: 0.2, ease: EASE }}>
            <RoomMockup payload={p} className="rounded-[28px] shadow-[0_50px_100px_-40px_rgba(78,15,29,.45)] lg:ml-10" />
          </motion.div>
          <motion.div style={{ y: phoneY }} initial={reduce ? false : { opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 70, damping: 18, delay: 0.7 }}
            className="absolute -bottom-6 right-2 w-[30%] sm:-left-2 sm:right-auto sm:w-[27%] lg:-left-6">
            <PhoneFrame><PhoneDashboard /></PhoneFrame>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------- places marquee
function Places() {
  const reduce = useReducedMotion();
  const row = [...PLACES, ...PLACES];
  return (
    <div className="relative overflow-hidden border-y border-line bg-surface-wash py-5" aria-label="Hosts from Diani to Kigali">
      <motion.div className="flex w-max items-center gap-8 whitespace-nowrap" animate={reduce ? undefined : { x: ["0%", "-50%"] }} transition={{ duration: 45, ease: "linear", repeat: Infinity }}>
        {row.map((p, i) => (
          <span key={i} className="flex items-center gap-8 font-display text-xl font-medium text-navy/70">
            {p}<span aria-hidden className="h-2.5 w-2.5 rounded-full border-2 border-maroon" />
          </span>
        ))}
      </motion.div>
    </div>
  );
}

// --------------------------------------------- story: a stay, told by the TV
const STORY: { state: ScreenState; layout: "fullphoto" | "minimal"; title: string; body: string; icon: string }[] = [
  { state: "arriving", layout: "fullphoto", icon: "door", title: "They walk in. The TV says their name.", body: "“Karibu, Christine!” on arrival, from your Airbnb or Booking.com calendar. Wi-Fi joins in one scan." },
  { state: "arriving", layout: "minimal", icon: "pin", title: "During the stay, it's their local guide.", body: "Your favourite beach, a trusted taxi, the housekeeping schedule. One QR code opens it all on their phone." },
  { state: "checkout", layout: "fullphoto", icon: "star", title: "On check-out morning, it asks for the review.", body: "The steps for leaving, then “Loved your stay?” with a QR code straight to your review page." },
];

const storyPayload = (i: number) => {
  const coast = TEMPLATES[0];
  return samplePayload({ state: STORY[i].state, property: { layout: STORY[i].layout, theme: coast.theme, photo_url: coast.photo, motion: false } });
};

function Story() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setStep(Number((e.target as HTMLElement).dataset.step));
    }, { rootMargin: "-45% 0px -45% 0px" });
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <section id="story" className="scroll-mt-16 bg-white px-4 py-14 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <Reveal><h2 className={`max-w-3xl ${H2}`}>A whole stay, hosted by the TV on your wall.</h2></Reveal>
        <div className="mt-8 grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            {STORY.map((x, i) => (
              <div key={x.title} ref={(el) => { refs.current[i] = el; }} data-step={i} className="flex min-h-[40vh] items-center py-6 lg:min-h-[60vh]">
                <div className={`transition-opacity duration-500 ${step === i ? "opacity-100" : "lg:opacity-35"}`}>
                  <span className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${step === i ? "bg-maroon text-white" : "bg-mint-soft text-maroon"}`}><Icon name={x.icon} size={20} /></span>
                  <h3 className="mt-5 font-display text-3xl font-semibold leading-tight text-navy">{x.title}</h3>
                  <p className="mt-3 max-w-md text-lg text-ink-muted">{x.body}</p>
                  <div className="mt-6 lg:hidden">
                    <div className="aspect-video overflow-hidden rounded-xl bg-navy shadow-panel"><WelcomeScreen payload={storyPayload(i)} /></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden lg:block">
            <div className="sticky top-28">
              <div className="rounded-[22px] bg-[#0d0e17] p-2.5 shadow-[0_40px_90px_-40px_rgba(23,24,42,.7)]">
                <div className="relative aspect-video overflow-hidden rounded-[14px] bg-navy">
                  <AnimatePresence mode="wait">
                    <motion.div key={step} className="absolute inset-0" initial={reduce ? false : { opacity: 0, scale: 1.02 }} animate={{ opacity: 1, scale: 1 }} exit={reduce ? undefined : { opacity: 0 }} transition={{ duration: 0.6, ease: EASE }}>
                      <WelcomeScreen payload={storyPayload(step)} />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
              <div className="mx-auto h-3 w-40 rounded-b-xl bg-[#0d0e17]" />
              <div className="mt-6 flex justify-center gap-2">
                {STORY.map((x, i) => <span key={x.title} className={`h-1.5 rounded-full transition-all duration-500 ${step === i ? "w-10 bg-maroon" : "w-4 bg-line-strong/40"}`} />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// --------------------------------------------------------- features bento
function GuidePhone() {
  return (
    <div className="flex h-full flex-col bg-[#07303a] text-[#f7f5f2]" style={{ fontSize: 10 }}>
      <div className="h-[0.9em] bg-[url(/brand/kitenge-strip.svg)] bg-[length:auto_100%] bg-repeat-x" />
      <div className="px-[8%] pt-[14%]">
        <p className="text-[0.8em] font-semibold uppercase tracking-[0.16em] text-[#ffb870]">Diani Beach</p>
        <p className="mt-[0.3em] font-display text-[1.7em] font-semibold leading-tight">Karibu to Casa Mara</p>
        {[["Ali Barbour's Cave", "Dinner in a coral cave"], ["Colobus Conservation", "Monkey walks every morning"], ["Kongo River mouth", "Quiet beach at sunset"]].map(([a, b]) => (
          <div key={a} className="mt-[0.8em] rounded-[1em] bg-white/10 p-[1em]"><p className="font-semibold">{a}</p><p className="text-white/60">{b}</p><p className="mt-[0.3em] font-semibold text-[#ffb870]">Directions</p></div>
        ))}
        <div className="mt-[0.8em] flex items-center justify-between rounded-[1em] bg-white/10 p-[1em]"><span><b className="block">Airport transfer</b><span className="text-white/60">KES 3,500</span></span><span className="rounded-full bg-[#ffb870] px-[0.9em] py-[0.4em] font-semibold text-[#17182a]">Request</span></div>
      </div>
    </div>
  );
}

function Features() {
  return (
    <Section id="features" className="bg-surface-wash">
      <Reveal><h2 className={`max-w-3xl ${H2}`}>Small touches that earn five stars, and a little extra.</h2></Reveal>
      <div className="mt-12 grid gap-4 md:grid-cols-6">
        <Reveal className="md:col-span-4 md:row-span-2">
          <div className="grid h-full overflow-hidden rounded-[24px] bg-white shadow-card sm:grid-cols-[1.1fr_0.9fr]">
            <div className="p-7 sm:p-9">
              <Icon name="pin" size={24} className="text-maroon" />
              <h3 className="mt-5 font-display text-2xl font-semibold text-navy">Your local guide, on every guest's phone</h3>
              <p className="mt-3 text-ink-muted">Add up to six favourite places and the extras you arrange. Guests scan the QR on the TV, get directions and request a transfer or late check-out on WhatsApp.</p>
              <p className="mt-6 text-sm font-semibold text-maroon">See which picks get the most taps in Insights.</p>
            </div>
            <div className="relative flex items-end justify-center overflow-hidden bg-[linear-gradient(160deg,#faf0f2,#f6f5f9)] px-8 pt-8">
              <PhoneFrame className="w-[62%] max-w-[220px] translate-y-6"><GuidePhone /></PhoneFrame>
            </div>
          </div>
        </Reveal>
        <Reveal delay={0.08} className="md:col-span-2">
          <div className="flex h-full flex-col rounded-[24px] bg-maroon p-7 text-white">
            <Icon name="star" size={24} />
            <h3 className="mt-5 font-display text-xl font-semibold">More reviews</h3>
            <p className="mt-2 text-white/80">Check-out morning: “Loved your stay?” and a QR code to your review page.</p>
          </div>
        </Reveal>
        <Reveal delay={0.12} className="md:col-span-2">
          <div className="kb-kitenge-panel relative flex h-full min-h-[200px] flex-col justify-end overflow-hidden rounded-[24px] p-7">
            <div className="rounded-[16px] bg-white/95 p-5 backdrop-blur">
              <p className="flex items-center gap-2 font-display text-lg font-semibold text-navy"><Icon name="broom" size={18} className="text-maroon" />Housekeeping on screen</p>
              <p className="mt-1 text-sm text-ink-muted">“Tue and Fri at 10:00”. No surprise knocks.</p>
            </div>
          </div>
        </Reveal>
        <Reveal delay={0.06} className="md:col-span-3">
          <div className="h-full rounded-[24px] bg-navy p-7 text-bone">
            <Icon name="sparkle" size={24} className="text-[#f3b0bd]" />
            <h3 className="mt-5 font-display text-xl font-semibold">Guest insights</h3>
            <p className="mt-2 text-bone/70">See which picks guests visit most, which extras they request and when they open the guide.</p>
          </div>
        </Reveal>
        <Reveal delay={0.1} className="md:col-span-3">
          <div className="h-full rounded-[24px] bg-white p-7 shadow-card">
            <Icon name="calendar" size={24} className="text-maroon" />
            <h3 className="mt-5 font-display text-xl font-semibold text-navy">Follows your calendars</h3>
            <p className="mt-2 text-ink-muted">Airbnb, Booking.com, Vrbo, Google Calendar or any iCal link. The right name appears by itself.</p>
            <div className="mt-5 flex flex-wrap gap-2">{["Airbnb", "Booking.com", "Vrbo", "Google", "iCal"].map((n) => <span key={n} className="rounded-full border border-line px-3 py-1 text-sm font-medium">{n}</span>)}</div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

// -------------------------------------------------------- templates
function Templates() {
  const [state, setState] = useState<ScreenState>("arriving");
  return (
    <Section id="templates" className="bg-white">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <Reveal><h2 className={`max-w-2xl ${H2}`}>A look for every kind of stay.</h2></Reveal>
        <div className="inline-flex rounded-full border border-line p-1" role="radiogroup" aria-label="Screen">
          {([["arriving", "During the stay"], ["checkout", "Check-out day"]] as const).map(([v, l]) => (
            <button key={v} role="radio" aria-checked={state === v} onClick={() => setState(v)} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${state === v ? "bg-navy text-white" : "hover:bg-surface-wash"}`}>{l}</button>
          ))}
        </div>
      </div>
      <div className="no-scrollbar -mx-4 mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 sm:-mx-8 sm:px-8">
        {TEMPLATES.map((t, i) => (
          <Reveal key={t.key} delay={i * 0.06} className="w-[85%] shrink-0 snap-start sm:w-[46%] lg:w-[38%]">
            <div className="group">
              <div className="rounded-[18px] bg-[#0d0e17] p-2 shadow-[0_30px_60px_-35px_rgba(23,24,42,.6)] transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] group-hover:-translate-y-1.5">
                <div className="aspect-video overflow-hidden rounded-[12px]"><WelcomeScreen payload={samplePayload({ state, property: { layout: t.layout, theme: t.theme, photo_url: t.photo, motion: false } })} /></div>
              </div>
              <p className="mt-4 font-display text-xl font-semibold text-navy">{t.label}</p>
              <p className="text-sm text-ink-muted">{t.blurb}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

// ------------------------------------------------------------- any TV
function AnyTv() {
  const steps = [
    ["Install", "Get Karibu TV on the TV with the free Downloader app. It's a normal app install, not jailbreaking."],
    ["Pair", "The TV shows a 6-character code. Type it in your dashboard and pick the room."],
    ["Host", "From then on the TV switches screens by itself: arrival, the stay, check-out."],
  ];
  return (
    <Section id="tvs" className="bg-surface-wash">
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <Reveal><h2 className={H2}>Set up in ten minutes, on almost any TV.</h2></Reveal>
          <ol className="mt-10 space-y-7">
            {steps.map(([t, b], i) => (
              <Reveal key={t} delay={i * 0.08}>
                <li className="flex gap-5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy font-display text-lg font-semibold text-white">{i + 1}</span>
                  <div><p className="font-display text-xl font-semibold text-navy">{t}</p><p className="mt-1 text-ink-muted">{b}</p></div>
                </li>
              </Reveal>
            ))}
          </ol>
          <Reveal delay={0.2}>
            <div id="download" className="mt-10 scroll-mt-24 rounded-[20px] border border-line bg-white p-6">
              <p className="font-display text-lg font-semibold text-navy">Get the TV app</p>
              <p className="mt-1 text-sm text-ink-muted">On the TV, open the browser or the Downloader app and type</p>
              <p className="mt-2 break-all font-display text-2xl font-semibold text-maroon">{CONFIG.app_short_url.replace(/^https?:\/\//, "")}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={CONFIG.apk_url} className="kb-btn kb-btn--primary kb-btn--md"><Icon name="download" size={18} />Download the TV app</a>
                <Link to="/signup" className="kb-btn kb-btn--secondary kb-btn--md">Create your free account</Link>
              </div>
            </div>
          </Reveal>
          <p className="mt-8 text-sm text-ink-muted">Works out of the box on Android TV, Google TV and Fire TV: TCL, Hisense, Vitron, Skyworth, Syinix, Sony, Xiaomi.</p>
        </div>
        <Reveal delay={0.1}><OtherTvs compact /></Reveal>
      </div>
    </Section>
  );
}

// ------------------------------------------------------------- pricing
function Pricing() {
  const [tvs, setTvs] = useState(2);
  const [cur, setCur] = useState<Currency>("KES");
  const intro = quote(tvs, 1, cur), standard = quote(tvs, 4, cur);
  const m = (n: number) => formatMoney(n, cur);
  return (
    <Section id="pricing" className="bg-white">
      <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <div>
          <Reveal><h2 className={H2}>Simple pricing, per TV.</h2></Reveal>
          <p className="mt-4 max-w-md text-lg text-ink-muted">Free for one TV. Pro is {m(quote(1, 1, cur).unit)} per TV for your first three months, then {m(quote(1, 4, cur).unit)}. Five or more TVs: 15% off everything.</p>
          <div className="mt-8 rounded-[20px] border border-line p-6">
            <p className="font-display text-xl font-semibold text-navy">Free</p>
            <p className="mt-1 text-sm text-ink-muted">1 TV and 1 property, forever. Guest names, Wi-Fi QR, rules, local guide and review prompt.</p>
          </div>
        </div>
        <Reveal delay={0.1}>
          <div className="overflow-hidden rounded-[24px] bg-navy text-bone shadow-[0_40px_90px_-40px_rgba(23,24,42,.8)]">
            <div className="kb-kikoi" />
            <div className="p-7 sm:p-9">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-display text-2xl font-semibold">Pro</p>
                <div className="inline-flex rounded-full bg-white/10 p-1" role="radiogroup" aria-label="Currency">
                  {(["KES", "USD"] as const).map((c) => <button key={c} role="radio" aria-checked={cur === c} onClick={() => setCur(c)} className={`rounded-full px-4 py-1 text-sm font-semibold ${cur === c ? "bg-white text-navy" : "text-bone/80"}`}>{c}</button>)}
                </div>
              </div>
              <label htmlFor="tv-count" className="mt-8 flex items-baseline justify-between">
                <span className="text-bone/70">How many TVs?</span>
                <span className="font-display text-4xl font-semibold tabular-nums">{tvs}</span>
              </label>
              <input id="tv-count" type="range" min={1} max={20} value={tvs} onChange={(e) => setTvs(Number(e.target.value))}
                className="mt-3 w-full accent-[#f3b0bd]" aria-valuetext={`${tvs} TVs`} />
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[16px] bg-white/[0.07] p-5">
                  <p className="text-sm text-bone/70">Months 1 to 3</p>
                  <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{m(intro.total)}</p>
                  <p className="text-sm text-bone/60">per month</p>
                </div>
                <div className="rounded-[16px] bg-white/[0.07] p-5">
                  <p className="text-sm text-bone/70">From month 4</p>
                  <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{m(standard.total)}</p>
                  <p className="text-sm text-bone/60">per month</p>
                </div>
              </div>
              <p className="mt-5 min-h-[1.5rem] text-sm">
                {intro.bulk ? <span className="font-semibold text-[#f3b0bd]">15% multi-TV discount applied: you save {m(standard.discount)} a month.</span>
                  : <span className="text-bone/60">Add {5 - tvs} more TV{5 - tvs > 1 ? "s" : ""} for 15% off the whole bill.</span>}
              </p>
              <ul className="mt-6 grid gap-2 text-sm text-bone/85 sm:grid-cols-2">
                {["Calendar sync: Airbnb, Booking.com, Vrbo", "Up to 50 properties", "Your logo, no Karibu badge", "Weather on screen", "Guest guide insights", "Pay by M-Pesa or card"].map((x) => (
                  <li key={x} className="flex gap-2"><Icon name="check" size={16} className="mt-0.5 text-[#f3b0bd]" />{x}</li>
                ))}
              </ul>
              <ButtonLink to="/signup" size="lg" className="mt-8 w-full !bg-white !text-navy hover:!bg-bone">Start free</ButtonLink>
              <p className="mt-3 text-center text-xs text-bone/60">Every new account gets 30 days of Pro. No card needed.</p>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

// ----------------------------------------------------------------- FAQ
const FAQ: [string, string][] = [
  ["Which TVs does it work on?", "Android TV, Google TV and Fire TV: TCL, Hisense, Vitron, Skyworth, Syinix, Sony, Xiaomi, Chromecast with Google TV. For Samsung, LG and older TVs, plug in a Google TV stick."],
  ["Is installing the app safe? Isn't it jailbreaking?", "It's not jailbreaking. Android TVs let you install apps from outside the Play Store once you allow it for one app (Downloader). Nothing on the TV is unlocked or modified, and you can uninstall it like any app."],
  ["Do guests need to install anything?", "No. Guests just look at the TV. For Wi-Fi or the local guide they point their phone camera at a QR code."],
  ["We have a TV in the bedroom and the living room. Is that OK?", "Yes. Pair each TV to the same property and name it by room. They all greet the same guest and update together. Each TV counts once on your plan."],
  ["Where do guest names come from?", "Type the first name when you add a booking, or connect your Airbnb, Booking.com or Vrbo calendar and just add the name."],
  ["What if the internet or power goes?", "The app starts by itself when the TV comes back on and shows the last screen it had, even offline. It catches up when the connection returns."],
  ["How do I pay?", "Free needs no payment. Pro is paid per TV by M-Pesa or card: KES 399 per TV for the first three months, then KES 499, with 15% off for 5 or more TVs."],
  ["What do you keep about guests?", "Only the first name and stay dates, deleted 30 days after check-out. Host accounts are protected with strong passwords and two-step verification."],
];

function Faq() {
  return (
    <Section id="faq" className="bg-surface-wash">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <Reveal><h2 className={H2}>Questions hosts ask.</h2></Reveal>
        <div className="space-y-3">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group rounded-[18px] bg-white px-6 py-5 shadow-card open:shadow-panel">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-semibold text-navy">
                {q}<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mint-soft text-maroon transition-transform duration-300 group-open:rotate-45"><Icon name="plus" size={14} /></span>
              </summary>
              <p className="mt-3 text-ink-muted">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ------------------------------------------------------------ contact
function Contact() {
  const [f, setF] = useState({ name: "", email: "", whatsapp: "", city: "", tv_brand: "TCL", tv_count: "1", message: "", website: "" });
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.name.trim() || (!f.whatsapp.trim() && !f.email.trim())) { setError("Add your name and a WhatsApp number or email so we can reach you."); return; }
    setState("sending"); setError("");
    try {
      if (f.website) { setState("done"); return; } // honeypot
      const params = new URLSearchParams(window.location.search);
      const source = ["utm_source", "utm_medium", "utm_campaign"].map((k) => params.get(k)).filter(Boolean).join("/");
      const { error: err } = await supabase.from("leads").insert({
        name: f.name.trim().slice(0, 80), email: f.email.trim().slice(0, 120), whatsapp: f.whatsapp.slice(0, 20),
        city: f.city.trim().slice(0, 60), tv_brand: f.tv_brand, tv_count: Math.max(0, Math.min(999, parseInt(f.tv_count, 10) || 0)),
        message: f.message.trim().slice(0, 1000), source: source.slice(0, 200),
      });
      if (err) throw new Error("Couldn't send. Try WhatsApp instead.");
      track("generate_lead", { tv_brand: f.tv_brand || "unknown" });
      setState("done");
    } catch (err) { setError((err as Error).message); setState("idle"); }
  };
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const waDisplay = BRAND.supportWhatsApp.replace(/^(\+\d{3})(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3 $4");
  return (
    <Section id="contact" className="bg-white">
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <Reveal><h2 className={H2}>Want us to set it up with you?</h2></Reveal>
          <p className="mt-4 max-w-md text-lg text-ink-muted">Tell us about your place. We'll WhatsApp you the steps, or walk you through it on a call.</p>
          <div className="mt-8 space-y-3">
            <a className="flex items-center gap-3 font-semibold text-navy hover:text-maroon" href={waLink(BRAND.supportWhatsApp, "Hi! I'm interested in Karibu TV.")} target="_blank" rel="noreferrer"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25d366] text-white"><WhatsAppIcon size={18} /></span>{waDisplay}</a>
            <a className="flex items-center gap-3 font-semibold text-navy hover:text-maroon" href={`mailto:${BRAND.email}`}><span className="flex h-10 w-10 items-center justify-center rounded-full bg-mint-soft text-maroon"><Icon name="mail" size={18} /></span>{BRAND.email}</a>
          </div>
        </div>
        <div className="rounded-[24px] border border-line bg-surface-wash p-6 sm:p-8">
          {state === "done" ? (
            <div className="py-10 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-maroon text-white"><Icon name="check" size={26} /></span>
              <p className="mt-4 font-display text-2xl font-semibold text-navy">Thanks! We'll WhatsApp you shortly.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
              {error && <p role="alert" className="kb-error sm:col-span-2">{error}</p>}
              <Field label="Name">{(id) => <Input id={id} value={f.name} onChange={set("name")} autoComplete="name" />}</Field>
              <Field label="Email" optional>{(id) => <Input id={id} type="email" value={f.email} onChange={set("email")} autoComplete="email" />}</Field>
              <Field label="WhatsApp" className="sm:col-span-2">{(id) => <PhoneInput id={id} value={f.whatsapp} onChange={(v) => setF((x) => ({ ...x, whatsapp: v }))} />}</Field>
              <Field label="Town" optional>{(id) => <Input id={id} value={f.city} onChange={set("city")} placeholder="Diani, Kigali, Arusha…" />}</Field>
              <div className="grid grid-cols-[1fr_6rem] gap-3">
                <Field label="TV brand">{(id) => <Select id={id} value={f.tv_brand} onChange={set("tv_brand")}>{TV_BRANDS.map((b) => <option key={b} value={b}>{b === "other" ? "Other" : b}</option>)}</Select>}</Field>
                <Field label="TVs">{(id) => <Input id={id} type="number" min={1} value={f.tv_count} onChange={set("tv_count")} />}</Field>
              </div>
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
    <section className="relative overflow-hidden bg-maroon px-4 py-16 text-white sm:px-8 sm:py-20">
      <div aria-hidden className="kb-kitenge-panel absolute inset-0 opacity-[0.12]" />
      <div className="relative mx-auto max-w-4xl text-center">
        <Reveal><h2 className="font-display text-[clamp(2.2rem,5vw,4rem)] font-semibold leading-[1.02] tracking-[-0.02em]">Ready to say karibu?</h2></Reveal>
        <p className="mx-auto mt-4 max-w-lg text-lg text-white/80">Set up in ten minutes. Free for one TV, with 30 days of Pro to try everything.</p>
        <ButtonLink to="/signup" size="lg" className="mt-9 !bg-white !text-maroon hover:!bg-bone">Start free</ButtonLink>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-navy px-4 pb-10 text-bone sm:px-8">
      <div className="kb-kikoi -mx-4 sm:-mx-8" />
      <div className="mx-auto grid max-w-7xl gap-8 pt-12 sm:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div><Logo light /><p className="mt-3 text-sm text-bone/60">Welcome screens for holiday rentals across East Africa.</p></div>
        <div className="space-y-2 text-sm"><p className="font-semibold">Product</p><a href="#features" className="block text-bone/70 hover:text-bone">Features</a><a href="#pricing" className="block text-bone/70 hover:text-bone">Pricing</a><a href="#faq" className="block text-bone/70 hover:text-bone">FAQ</a><a href={CONFIG.apk_url} className="block text-bone/70 hover:text-bone">Download the TV app</a></div>
        <div className="space-y-2 text-sm"><p className="font-semibold">Legal</p><Link to="/privacy" className="block text-bone/70 hover:text-bone">Privacy</Link><Link to="/terms" className="block text-bone/70 hover:text-bone">Terms</Link></div>
        <div className="space-y-2 text-sm"><p className="font-semibold">Contact</p><a href={waLink(BRAND.supportWhatsApp)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-bone/70 hover:text-bone"><WhatsAppIcon size={15} />WhatsApp</a><a href={`mailto:${BRAND.email}`} className="block text-bone/70 hover:text-bone">{BRAND.email}</a></div>
      </div>
      <p className="mx-auto mt-10 max-w-7xl text-xs leading-relaxed text-bone/45">© {new Date().getFullYear()} {BRAND.name}.</p>
    </footer>
  );
}

function JsonLd() {
  useEffect(() => {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.text = JSON.stringify([
      { "@context": "https://schema.org", "@type": "SoftwareApplication", name: BRAND.name, applicationCategory: "BusinessApplication", operatingSystem: "Android TV, Google TV, Fire TV, Web",
        offers: [{ "@type": "Offer", price: "0", priceCurrency: "KES", name: "Free" }, { "@type": "Offer", price: "399", priceCurrency: "KES", name: "Pro, per TV per month (first 3 months)" }] },
      { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    ]);
    document.head.appendChild(el);
    return () => el.remove();
  }, []);
  return null;
}

export default function Landing() {
  return (
    <div className="bg-white">
      <JsonLd />
      <Header />
      <main>
        <Hero />
        <Places />
        <Story />
        <KitengeDivider />
        <Features />
        <KitengeDivider />
        <Templates />
        <KitengeDivider />
        <AnyTv />
        <KitengeDivider />
        <Pricing />
        <KitengeDivider />
        <Faq />
        <KitengeDivider />
        <Contact />
        <Closing />
      </main>
      <Footer />
    </div>
  );
}
