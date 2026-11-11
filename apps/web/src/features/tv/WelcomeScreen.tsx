import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Layout, ScreenPayload } from "@/lib/types";
import { t } from "@/lib/i18n";
import { fmtDay, fmtWeekday } from "@/lib/dates";
import { qrSvg } from "@/lib/qr";
import { AMENITIES, Icon, WhatsAppIcon, weatherIcon } from "@/components/Icons";
import { resolveTheme, type TvTheme } from "./themes";

const W = 1920, H = 1080, M = 96, CARD_W = 520, GAP = 56, STRIP = 420;

/** Fixed 1920×1080 stage scaled to fit its container (TV viewport, preview card or room mockup). */
export function Stage({ children, shift = { x: 0, y: 0 }, bg }: { children: ReactNode; shift?: { x: number; y: number }; bg: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const el = outer.current;
    if (!el) return;
    const fitScale = () => setScale(Math.min(el.clientWidth / W, el.clientHeight / H));
    fitScale();
    const ro = new ResizeObserver(fitScale);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={outer} className="relative h-full w-full overflow-hidden" style={{ background: bg }}>
      <div style={{
        width: W, height: H, position: "absolute", left: "50%", top: "50%",
        transform: `translate(-50%, -50%) translate(${shift.x * scale}px, ${shift.y * scale}px) scale(${scale})`,
        visibility: scale ? "visible" : "hidden",
      }}>
        {children}
      </div>
    </div>
  );
}

/** Where the photo, the text column and the Wi-Fi card sit for each layout. */
function geometry(layout: Layout): { photo: CSSProperties | null; contentLeft: number; cardRight: number; contentRight?: number } {
  switch (layout) {
    case "classic": return { photo: { left: 0, width: STRIP }, contentLeft: STRIP + 80, cardRight: 80 };
    case "mirror": return { photo: { right: 0, width: STRIP }, contentLeft: M, cardRight: STRIP + 64 };
    case "spotlight": return { photo: { right: 0, width: 960 }, contentLeft: M, cardRight: 120, contentRight: 960 + 40 };
    case "fullphoto": return { photo: { left: 0, width: W }, contentLeft: M, cardRight: M };
    default: return { photo: null, contentLeft: M, cardRight: M };
  }
}

const fit = (text: string, width: number, max: number) => Math.max(60, Math.min(max, Math.floor(width / (Math.max(text.length, 6) * 0.5))));

function QrBox({ text, size }: { text: string; size: number }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let live = true;
    if (text) qrSvg(text, { margin: 0 }).then((s) => live && setSvg(s)); else setSvg("");
    return () => { live = false; };
  }, [text]);
  return <div style={{ width: size, height: size, background: "#fff", borderRadius: 22, padding: 18 }} className="shrink-0 [&>svg]:h-full [&>svg]:w-full" role="img" aria-label="Wi-Fi QR code" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function WifiCard({ p, th, compact }: { p: ScreenPayload; th: TvTheme; compact?: boolean }) {
  const { wifi } = p;
  if (!wifi.ssid) return null;
  const logoInCard = p.property.logo_url && p.property.logo_position === "wifi";
  return (
    <div style={{ background: th.panel, border: `2px solid ${th.panelLine}`, borderRadius: 36, padding: 36, color: th.text, width: CARD_W }}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 font-display" style={{ fontSize: 34, fontWeight: 600 }}>
          <span className="flex items-center justify-center" style={{ background: th.accent, color: th.onAccent, borderRadius: 999, width: 56, height: 56 }}><Icon name="wifi" size={32} strokeWidth={2.4} /></span>
          {t("wifi_title")}
        </div>
        {logoInCard && <img src={p.property.logo_url!} alt="" style={{ maxHeight: 52, maxWidth: 130, objectFit: "contain" }} />}
      </div>
      <div className="mt-7 flex items-center gap-6">
        <QrBox text={wifi.qr_string} size={compact ? 220 : 270} />
        <div style={{ fontSize: 28, color: th.muted, lineHeight: 1.25 }}>{t("wifi_scan")}</div>
      </div>
      <dl className="mt-7 space-y-3">
        <div><dt style={{ color: th.muted, fontSize: 28 }}>{t("network")}</dt><dd className="truncate font-semibold" style={{ fontSize: 38 }}>{wifi.ssid}</dd></div>
        <div>
          <dt style={{ color: th.muted, fontSize: 28 }}>{t("password")}</dt>
          <dd className="break-all font-semibold" style={{ fontSize: 38, fontFamily: "ui-monospace, Menlo, monospace" }}>
            {wifi.security === "nopass" ? <span style={{ fontFamily: "Inter, sans-serif" }}>{t("open_network")}</span>
              : wifi.password === null ? <span style={{ fontSize: 30, fontFamily: "Inter, sans-serif", fontWeight: 500 }}>{t("ask_host_password")}</span>
              : wifi.password}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function Weather({ p, th }: { p: ScreenPayload; th: TvTheme }) {
  const w = p.weather;
  if (!w) return null;
  return (
    <div style={{ background: th.panel, border: `2px solid ${th.panelLine}`, borderRadius: 30, padding: "22px 30px", color: th.text, width: CARD_W }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Icon name={weatherIcon(w.today.symbol)} size={52} style={{ color: th.accent }} />
          <div><div style={{ fontSize: 28, color: th.muted }}>{t("today")}</div><div className="font-display" style={{ fontSize: 46, fontWeight: 600, lineHeight: 1 }}>{w.today.temp_c}°</div></div>
        </div>
        <div className="flex gap-5">
          {w.days.map((d) => (
            <div key={d.date} className="text-center" style={{ fontSize: 28 }}>
              <div style={{ color: th.muted }}>{fmtWeekday(d.date).slice(0, 3)}</div>
              <Icon name={weatherIcon(d.symbol)} size={34} className="mx-auto my-1" />
              <div className="whitespace-nowrap">{d.max_c}°<span style={{ color: th.muted }}> {d.min_c}°</span></div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 18, color: th.muted, marginTop: 6 }}>{t("weather")}: MET Norway</div>
    </div>
  );
}

function Chip({ th, label, value }: { th: TvTheme; label: string; value: ReactNode }) {
  return (
    <div style={{ background: th.chip, borderRadius: 26, padding: "18px 28px", color: th.text }}>
      <div style={{ fontSize: 28, color: th.muted }}>{label}</div>
      <div className="font-display" style={{ fontSize: 36, fontWeight: 600, lineHeight: 1.15 }}>{value}</div>
    </div>
  );
}

function Amenities({ p, th }: { p: ScreenPayload; th: TvTheme }) {
  const list = p.property.amenities.map((k) => AMENITIES.find((a) => a.key === k)).filter(Boolean).slice(0, 6);
  if (!list.length) return null;
  return (
    <div className="flex flex-wrap gap-x-9 gap-y-4" style={{ fontSize: 28, color: th.text }}>
      {list.map((a) => <div key={a!.key} className="flex items-center gap-3"><Icon name={a!.key} size={34} style={{ color: th.accent }} /><span>{a!.label}</span></div>)}
    </div>
  );
}

function Rules({ p, th }: { p: ScreenPayload; th: TvTheme }) {
  const pr = p.property;
  const items = pr.house_rules.slice(0, 6).map((r) => ({ icon: r.icon, text: r.text }));
  if (pr.max_guests) items.push({ icon: "guests", text: t("max_guests", { n: pr.max_guests }) });
  if (pr.quiet_start && pr.quiet_end) items.push({ icon: "quiet", text: t("quiet_hours", { from: pr.quiet_start, to: pr.quiet_end }) });
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {items.slice(0, 8).map((r, i) => (
        <div key={i} className="flex items-center gap-3" style={{ background: th.chip, color: th.text, borderRadius: 999, padding: "12px 26px", fontSize: 28 }}>
          <Icon name={r.icon} size={30} style={{ color: th.accent }} /><span>{r.text}</span>
        </div>
      ))}
    </div>
  );
}

function HostLine({ p, th }: { p: ScreenPayload; th: TvTheme }) {
  const { host_name, host_contact } = p.property;
  if (!host_name && !host_contact) return null;
  return (
    <div className="flex flex-wrap items-center gap-3" style={{ fontSize: 30, color: th.text }}>
      <span style={{ color: th.accent }}><WhatsAppIcon size={34} /></span>
      <span>{host_name ? t("need_anything", { host: host_name }) : "Need anything? WhatsApp us"}</span>
      {host_contact && <span className="font-semibold" style={{ color: th.accent }}>{host_contact}</span>}
    </div>
  );
}

const Accent = ({ children, th }: { children: ReactNode; th: TvTheme }) => <span style={{ color: th.accent }}>{children}</span>;

function withName(template: string, name: string, th: TvTheme): ReactNode {
  const parts = template.split("{name}");
  if (parts.length === 1) return template;
  return parts.flatMap((part, i) => (i === 0 ? [part] : [<Accent key={i} th={th}>{name}</Accent>, part]));
}

function Main({ p, th, width }: { p: ScreenPayload; th: TvTheme; width: number }) {
  const pr = p.property;
  const name = p.stay?.first_name?.trim() || "";
  const headline = (text: string): CSSProperties => ({ fontSize: fit(text, width, 120), fontWeight: 600, lineHeight: 1.03, letterSpacing: "-0.02em" });

  if (p.state === "arriving" && p.stay) {
    const tpl = pr.welcome_title || "Welcome, {name}!";
    const plain = name ? tpl.split("{name}").join(name) : tpl.includes("{name}") ? t("greeting_noname") : tpl;
    const nights = p.stay.nights === 1 ? t("night") : t("nights", { n: p.stay.nights });
    return (
      <>
        <h1 className="font-display" style={headline(plain)}>{name ? withName(tpl, name, th) : plain}</h1>
        {pr.welcome_note && <p style={{ fontSize: 34, color: th.muted, marginTop: 22, lineHeight: 1.3 }}>{pr.welcome_note}</p>}
        <div className="mt-10 flex flex-wrap gap-4">
          <Chip th={th} label={t("your_stay")} value={<>{fmtDay(p.stay.checkin)} → {fmtDay(p.stay.checkout)} · {nights}</>} />
          <Chip th={th} label={t("checkout")} value={<>{fmtWeekday(p.stay.checkout)}, {pr.checkout_time}</>} />
        </div>
        <div className="mt-10"><Amenities p={p} th={th} /></div>
      </>
    );
  }

  if (p.state === "checkout") {
    const steps = pr.checkout_steps.slice(0, 6);
    return (
      <>
        <h1 className="font-display" style={headline(`Check-out today by ${pr.checkout_time}`)}>Check-out <Accent th={th}>today</Accent> by {pr.checkout_time}</h1>
        <p style={{ fontSize: 34, color: th.muted, marginTop: 20, lineHeight: 1.3 }}>
          Thank you for staying with us{name ? <>, <Accent th={th}>{name}</Accent></> : ""}! We hope you enjoyed your stay.
        </p>
        {steps.length > 0 && (
          <div className="mt-9" style={{ background: th.panel, border: `2px solid ${th.panelLine}`, borderRadius: 32, padding: "28px 34px" }}>
            <div style={{ fontSize: 24, color: th.muted, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>{t("checkout_steps")}</div>
            <ol className="grid gap-x-8 gap-y-3" style={{ gridTemplateColumns: steps.length > 3 && width > 900 ? "1fr 1fr" : "1fr" }}>
              {steps.map((s, i) => (
                <li key={i} className="flex items-start gap-4" style={{ fontSize: 29, lineHeight: 1.25 }}>
                  <span className="flex shrink-0 items-center justify-center font-display" style={{ width: 44, height: 44, borderRadius: 999, background: th.accent, color: th.onAccent, fontWeight: 700, fontSize: 26 }}>{i + 1}</span>
                  <span style={{ paddingTop: 5 }}>{s}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </>
    );
  }

  const gtitle = pr.generic_title || t("welcome_to", { name: pr.name });
  return (
    <>
      <h1 className="font-display" style={headline(gtitle)}>{gtitle}</h1>
      {(pr.generic_note || pr.tagline) && <p style={{ fontSize: 34, color: th.muted, marginTop: 22, lineHeight: 1.3 }}>{pr.generic_note || pr.tagline}</p>}
      <div className="mt-10"><Amenities p={p} th={th} /></div>
    </>
  );
}

function Footer({ p, th }: { p: ScreenPayload; th: TvTheme }) {
  const pr = p.property;
  if (p.state === "checkout") {
    return (
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div style={{ fontSize: 30, color: th.text }}>{pr.thankyou_line || `Thank you for staying at ${pr.name}!`}</div>
        {pr.contact_title || pr.contact_line ? (
          <div style={{ maxWidth: 520 }}>
            {pr.contact_title && <div className="font-display" style={{ fontSize: 30, fontWeight: 600, color: th.accent }}>{pr.contact_title}</div>}
            {pr.contact_line && <div style={{ fontSize: 26, color: th.muted, lineHeight: 1.3 }}>{pr.contact_line}</div>}
          </div>
        ) : <HostLine p={p} th={th} />}
      </div>
    );
  }
  return <div className="flex flex-col gap-5"><Rules p={p} th={th} /><HostLine p={p} th={th} /></div>;
}

function Header({ p, th }: { p: ScreenPayload; th: TvTheme }) {
  const pr = p.property;
  return (
    <div className="flex items-center gap-5" style={{ color: th.muted, fontSize: 28 }}>
      {pr.logo_url && pr.logo_position === "header" && <img src={pr.logo_url} alt="" style={{ maxHeight: 68, maxWidth: 220, objectFit: "contain" }} />}
      <span className="font-semibold" style={{ color: th.text }}>{pr.name}</span>
      {pr.area && <><span aria-hidden>·</span><span>{pr.area}</span></>}
    </div>
  );
}

/** The guest-facing screen. Pure function of the payload. */
export function WelcomeScreen({ payload, shift, overlay }: { payload: ScreenPayload; shift?: { x: number; y: number }; overlay?: ReactNode }) {
  const p = payload;
  const th = resolveTheme(p.property.theme, p.property.color_bg, p.property.color_accent);
  const layout = p.property.layout;
  const g = geometry(layout);
  const photo = g.photo ? p.property.photo_url : null;
  const contentRight = g.contentRight ?? g.cardRight + CARD_W + GAP;
  const contentWidth = W - g.contentLeft - contentRight;

  return (
    <Stage shift={shift} bg={th.bg}>
      <div style={{ width: W, height: H, background: th.bg, color: th.text, fontFamily: "Inter, sans-serif", position: "relative", overflow: "hidden" }} lang="en">
        <div key={`${p.state}|${photo}|${layout}`} className="tv-fade absolute inset-0">
          {g.photo && (
            <div className="absolute" style={{ top: 0, bottom: 0, ...g.photo }}>
              {photo
                ? <img src={photo} alt="" className="h-full w-full object-cover" />
                : <div className="h-full w-full" style={{ background: `linear-gradient(135deg, ${th.chip}, ${th.panel})` }} />}
              {layout === "fullphoto" && <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, ${th.bg} 0%, ${th.bg}f0 38%, ${th.bg}aa 62%, ${th.bg}55 100%)` }} />}
              {layout === "spotlight" && <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, ${th.bg} 0%, ${th.bg}00 30%)` }} />}
              {(layout === "classic" || layout === "mirror") && <div className="absolute inset-0" style={{ background: `${th.bg}33` }} />}
            </div>
          )}
          <div className="absolute flex flex-col" style={{ left: g.contentLeft, top: M, bottom: M, right: contentRight }}>
            <Header p={p} th={th} />
            <div className="min-h-0 flex-1 overflow-hidden" style={{ paddingTop: 52 }}><Main p={p} th={th} width={contentWidth} /></div>
            <Footer p={p} th={th} />
          </div>
          <div className="absolute flex flex-col gap-5" style={{ right: g.cardRight, top: M + 64 }}>
            <WifiCard p={p} th={th} compact={!!p.weather} />
            <Weather p={p} th={th} />
          </div>
        </div>
        <div className="absolute flex flex-col items-end gap-1" style={{ right: 40, bottom: 30 }}>
          {p.restricted && <div style={{ fontSize: 22, color: th.muted }}>{t("renew")}</div>}
          {p.plan.branded && <div className="flex items-center gap-2 font-display" style={{ opacity: 0.6, color: th.text, fontSize: 24, fontWeight: 600 }}><Icon name="tv" size={26} /> Karibu TV</div>}
        </div>
        {overlay}
      </div>
    </Stage>
  );
}

/** The guest screen shown on the TV in a living-room photo, for previews and examples. */
export function RoomMockup({ payload, className = "", children }: { payload: ScreenPayload; className?: string; children?: ReactNode }) {
  return (
    <div className={`relative overflow-hidden rounded-lg bg-[#efe9df] ${className}`} style={{ aspectRatio: "1024 / 800" }}>
      <img src="/mockups/living-room.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      {/* Screen area of the TV in the photo, measured in the 1024×800 crop. */}
      <div className="absolute overflow-hidden" style={{ left: "23.15%", top: "12.6%", width: "54.1%", height: "40.8%" }}>
        <WelcomeScreen payload={payload} />
        <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(115deg, rgba(255,255,255,.07) 0%, rgba(255,255,255,0) 35%)" }} />
      </div>
      {children}
    </div>
  );
}
