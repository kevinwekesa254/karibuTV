// Guest phone page: opened by scanning the QR on the TV. Host picks, extras on WhatsApp, review link.
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { samplePayload } from "@/lib/samples";
import { waLink } from "@/lib/brand";
import type { Extra, Pick } from "@/lib/types";
import { Icon, WhatsAppIcon } from "@/components/Icons";
import { LogoMark } from "@/components/Logo";
import { resolveTheme } from "@/features/tv/themes";

interface Guide {
  name: string; area: string; theme: string; color_bg: string; color_accent: string;
  host_name: string; host_contact: string; checkout_time: string;
  picks: Pick[]; extras: Extra[]; review_url: string;
}

function demoGuide(): Guide {
  const p = samplePayload().property;
  return { name: p.name, area: p.area, theme: "coast", color_bg: "", color_accent: "", host_name: p.host_name, host_contact: p.host_contact,
    checkout_time: p.checkout_time, picks: p.picks, extras: p.extras, review_url: p.review_url };
}

const mapsLink = (pick: Pick, area: string) =>
  pick.url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${pick.title} ${area}`.trim())}`;

export default function GuestGuide() {
  const { id = "" } = useParams();
  const [g, setG] = useState<Guide | null | undefined>(id === "demo" ? demoGuide() : undefined);

  useEffect(() => {
    if (id === "demo") return;
    if (!/^[0-9a-f-]{36}$/i.test(id)) { setG(null); return; }
    supabase.rpc("guest_guide", { p_property: id }).then(({ data, error }) => setG(error || !data ? null : (data as Guide)));
  }, [id]);

  useEffect(() => { if (g) document.title = `${g.name} · Guest guide`; }, [g]);

  if (g === undefined) return <div className="flex min-h-screen items-center justify-center bg-[#0c1f16]"><span className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" /></div>;
  if (g === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-surface-wash p-6 text-center">
        <LogoMark size={48} />
        <h1 className="font-display text-2xl font-semibold text-forest">This guide isn't available</h1>
        <p className="text-ink-muted">Ask your host for the latest link, or scan the code on the TV again.</p>
      </div>
    );
  }

  const th = resolveTheme(g.theme, g.color_bg, g.color_accent);
  const host = g.host_name || "your host";
  const ask = (text: string) => (g.host_contact ? waLink(g.host_contact, `Hi ${g.host_name || ""}! I'm staying at ${g.name}. ${text}`.replace("Hi !", "Hi!")) : "");

  return (
    <div className="min-h-screen" style={{ background: th.bg, color: th.text, ["--font-display" as string]: th.font }}>
      <div className="kb-kikoi" />
      <div className="mx-auto max-w-lg px-5 pb-16 pt-8">
        <p className="text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: th.accent }}>{g.area || "Guest guide"}</p>
        <h1 className="mt-2 font-display text-4xl font-semibold leading-tight">Karibu to {g.name}</h1>
        <p className="mt-3 text-lg" style={{ color: th.muted }}>{g.picks.length ? `${host}'s favourite spots nearby, and a few extras to make your stay easier.` : `A few extras ${host} can arrange for you.`}</p>

        {g.picks.length > 0 && (
          <section className="mt-9">
            <h2 className="font-display text-xl font-semibold">Local picks</h2>
            <ul className="mt-4 space-y-3">
              {g.picks.map((x, i) => (
                <li key={i} className="rounded-2xl p-4" style={{ background: th.panel, border: `1px solid ${th.panelLine}` }}>
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: th.chip, color: th.accent }}><Icon name="pin" size={18} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{x.title}</p>
                      {x.note && <p className="text-sm" style={{ color: th.muted }}>{x.note}</p>}
                      <a href={mapsLink(x, g.area)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: th.accent }}>
                        {x.url ? "Open link" : "Directions"}<Icon name="arrow-right" size={16} />
                      </a>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {g.extras.length > 0 && (
          <section className="mt-9">
            <h2 className="font-display text-xl font-semibold">Extras</h2>
            <p className="mt-1 text-sm" style={{ color: th.muted }}>Request on WhatsApp and {host} will confirm and arrange payment with you.</p>
            <ul className="mt-4 space-y-3">
              {g.extras.map((x, i) => (
                <li key={i} className="flex items-center justify-between gap-3 rounded-2xl p-4" style={{ background: th.panel, border: `1px solid ${th.panelLine}` }}>
                  <div className="min-w-0"><p className="font-semibold">{x.title}</p>{x.price && <p className="text-sm" style={{ color: th.muted }}>{x.price}</p>}</div>
                  {g.host_contact && (
                    <a href={ask(`I'd like to request: ${x.title}${x.price ? ` (${x.price})` : ""}.`)} target="_blank" rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold" style={{ background: th.accent, color: th.onAccent }}>
                      <WhatsAppIcon size={16} />Request
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-9 grid gap-3">
          {g.host_contact && (
            <a href={ask("I have a question.")} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-full px-5 py-3.5 font-semibold" style={{ border: `1.5px solid ${th.panelLine}` }}>
              <WhatsAppIcon size={18} />Message {host}
            </a>
          )}
          {g.review_url && (
            <a href={g.review_url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-full px-5 py-3.5 font-semibold" style={{ background: th.accent, color: th.onAccent }}>
              <Icon name="star" size={18} />Loved your stay? Leave a review
            </a>
          )}
        </section>

        <p className="mt-12 flex items-center justify-center gap-2 text-xs" style={{ color: th.muted }}><LogoMark size={18} />Welcome screen by Karibu TV</p>
      </div>
    </div>
  );
}
