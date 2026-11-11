import { useMemo, useRef, useState } from "react";
import { supabase, mediaUrl, uploadMedia, functionError, MEDIA_BUCKET } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { prepareLogo, resizeImage } from "@/lib/image";
import type { Layout, Property, ScreenPayload, ScreenState, ThemeName } from "@/lib/types";
import { Icon } from "@/components/Icons";
import { Button, Card, EmptyState, Field, Input, PageHeader, ProTag, Segmented, Spinner, Textarea, Toggle, Tag, ButtonLink } from "@/components/ui";
import { RoomMockup, WelcomeScreen } from "@/features/tv/WelcomeScreen";
import { THEMES } from "@/features/tv/themes";
import { useData } from "./data";
import { SaveBar, Section, SortableList, usePropertyDraft, useSaveProperty } from "./shared/editing";
import { PropertySwitcher, STATE_LABELS, usePreview } from "./shared/widgets";

const LAYOUTS: { value: Layout; label: string; desc: string }[] = [
  { value: "classic", label: "Classic", desc: "Photo strip on the left" },
  { value: "mirror", label: "Mirror", desc: "Photo strip on the right" },
  { value: "fullphoto", label: "Full photo", desc: "Your photo behind everything" },
  { value: "spotlight", label: "Spotlight", desc: "Photo fills the right half" },
  { value: "minimal", label: "Minimal", desc: "No photo, just your colours" },
];

function LayoutThumb({ layout, bg, accent }: { layout: Layout; bg: string; accent: string }) {
  const photo = "url(#hatch)";
  return (
    <svg viewBox="0 0 160 90" className="w-full rounded-sm" aria-hidden>
      <defs><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#a07a5a" /><rect width="4" height="8" fill="#8a6446" /></pattern></defs>
      <rect width="160" height="90" fill={bg} />
      {layout === "classic" && <rect width="36" height="90" fill={photo} />}
      {layout === "mirror" && <rect x="124" width="36" height="90" fill={photo} />}
      {layout === "fullphoto" && <><rect width="160" height="90" fill={photo} /><rect width="160" height="90" fill={bg} opacity=".55" /></>}
      {layout === "spotlight" && <><rect x="80" width="80" height="90" fill={photo} /><rect x="80" width="30" height="90" fill={bg} opacity=".5" /></>}
      {(() => {
        const x = layout === "classic" ? 44 : 12;
        const cx = layout === "mirror" ? 92 : layout === "spotlight" ? 120 : 126;
        return <>
          <rect x={x} y="20" width="22" height="6" rx="2" fill={accent} /><rect x={x + 24} y="20" width="22" height="6" rx="2" fill="#f7f5f2" />
          <rect x={x} y="31" width="38" height="4" rx="2" fill="#f7f5f2" opacity=".6" />
          <rect x={x} y="74" width="16" height="5" rx="2.5" fill="#f7f5f2" opacity=".3" /><rect x={x + 19} y="74" width="16" height="5" rx="2.5" fill="#f7f5f2" opacity=".3" />
          <rect x={cx} y="14" width="26" height="40" rx="4" fill="#f7f5f2" opacity=".18" stroke="#f7f5f2" strokeOpacity=".3" />
        </>;
      })()}
    </svg>
  );
}

function PhotoSlot({ property, field, label }: { property: Property; field: "photo_welcome" | "photo_checkout" | "photo_generic"; label: string }) {
  const { user } = useAuth();
  const { save } = useSaveProperty(property);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const current = property[field];
  const upload = async (file?: File) => {
    if (!file || !user) return;
    setBusy(true);
    try {
      const path = await uploadMedia(user.id, property.id, field, await resizeImage(file, 1600));
      const ok = await save({ [field]: path } as Partial<Property>, "Photo saved. Your TV updates in a few seconds.");
      if (ok && current) supabase.storage.from(MEDIA_BUCKET).remove([current]).catch(() => {});
    } catch (e) { toast((e as Error).message || "Upload failed.", "error"); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  };
  const remove = async () => {
    const ok = await save({ [field]: "" } as Partial<Property>, "Photo removed.");
    if (ok && current) supabase.storage.from(MEDIA_BUCKET).remove([current]).catch(() => {});
  };
  const id = `${field}-in`;
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-md border border-line bg-surface-wash">
        {current ? <img src={mediaUrl(current)} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-ink-muted"><Icon name="image" /></div>}
        {busy && <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-green"><Spinner size={18} /></div>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{label}</p>
        <p className="text-xs text-ink-muted">{current ? "Shown on this screen" : "No photo yet: the TV uses your colours"}</p>
      </div>
      <input ref={input} id={id} type="file" accept="image/*" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
      <label htmlFor={id} className="kb-btn kb-btn--secondary kb-btn--sm cursor-pointer">{current ? "Replace" : "Upload"}</label>
      {current && <Button variant="ghost" size="sm" onClick={remove} aria-label="Remove photo"><Icon name="x" size={16} /></Button>}
    </div>
  );
}

const DRAFT_KEYS = [
  "welcome_title", "welcome_note", "generic_title", "generic_note", "thankyou_line", "contact_title", "contact_line",
  "checkout_steps", "layout", "theme", "color_bg", "color_accent", "logo_position", "weather_enabled", "weather_place",
] as const;

function Editor({ property }: { property: Property }) {
  const { plan, user } = useAuth();
  const { openUpgrade } = useData();
  const toast = useToast();
  const { draft, set, dirty, reset } = usePropertyDraft(property, [...DRAFT_KEYS]);
  const { save, saving } = useSaveProperty(property);
  const [state, setState] = useState<ScreenState | null>(null);
  const [guest, setGuest] = useState("");
  const [logoBusy, setLogoBusy] = useState(false);

  const overrides = useMemo(() => ({ ...draft }), [draft]);
  const { live } = usePreview(property);
  const active = state ?? live ?? "arriving";
  const { payload } = usePreview(property, { state: active, sampleName: guest.trim() || undefined, overrides });
  const thumbs = {
    arriving: usePreview(property, { state: "arriving", overrides }).payload,
    checkout: usePreview(property, { state: "checkout", overrides }).payload,
    between: usePreview(property, { state: "between", overrides }).payload,
  };

  const theme = draft.theme as ThemeName;
  const hexOk = (v: string) => /^#[0-9a-f]{6}$/i.test(v);
  const custom = theme === "custom";
  const valid = !custom || (hexOk(draft.color_bg) && hexOk(draft.color_accent));
  const steps = draft.checkout_steps || [];

  const onSave = async () => {
    if (draft.weather_enabled && !plan.pro) { openUpgrade("Weather on the TV is a Pro feature."); return; }
    const placeChanged = draft.weather_place.trim() !== property.weather_place;
    const rec = await save({ ...draft, checkout_steps: steps.map((s) => s.trim()).filter(Boolean), weather_place: draft.weather_place.trim() });
    if (rec?.weather_enabled && (placeChanged || !rec.weather_json)) {
      const { error } = await supabase.functions.invoke("weather", { body: { property_id: rec.id } });
      if (error) toast((await functionError(error)).message, "error");
    }
  };

  const uploadLogo = async (file?: File) => {
    if (!file || !user) return;
    if (!plan.pro) { openUpgrade("Show your own logo on the TV with Pro."); return; }
    setLogoBusy(true);
    try {
      const old = property.logo;
      const path = await uploadMedia(user.id, property.id, "logo", await prepareLogo(file));
      const ok = await save({ logo: path }, "Logo saved.");
      if (ok && old) supabase.storage.from(MEDIA_BUCKET).remove([old]).catch(() => {});
    } catch (e) { toast((e as Error).message || "Upload failed.", "error"); }
    finally { setLogoBusy(false); }
  };

  const allThemes = [...Object.values(THEMES).map((t) => ({ key: t.key, label: t.label, bg: t.bg, accent: t.accent })),
    { key: "custom", label: "Custom", bg: hexOk(draft.color_bg) ? draft.color_bg : "#333333", accent: hexOk(draft.color_accent) ? draft.color_accent : "#ffffff" }];
  const look = allThemes.find((t) => t.key === theme) || allThemes[0];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card className="p-4">
          {payload && <RoomMockup payload={payload} />}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1">
            <span className="text-sm text-ink-muted">{STATE_LABELS[active].title}</span>
            {active !== "between" && (
              <label className="flex items-center gap-2 text-sm font-semibold">Guest name
                <Input value={guest} onChange={(e) => setGuest(e.target.value)} placeholder="Guest" maxLength={40} className="!min-h-[38px] w-40 !py-1.5" />
              </label>
            )}
          </div>
        </Card>
        <div className="space-y-3">
          {(["arriving", "checkout", "between"] as ScreenState[]).map((s) => (
            <button key={s} onClick={() => setState(s)} aria-pressed={active === s}
              className={`flex w-full items-center gap-4 rounded-lg border-2 bg-surface p-3 text-left transition-colors ${active === s ? "border-forest shadow-card" : "border-line hover:border-line-strong"}`}>
              <div className="w-28 shrink-0 overflow-hidden rounded-md" style={{ aspectRatio: "16/9" }}>
                {property[STATE_LABELS[s].photo] ? <img src={mediaUrl(property[STATE_LABELS[s].photo] as string)} alt="" className="h-full w-full object-cover" />
                  : thumbs[s] ? <div className="pointer-events-none h-full w-full"><MiniScreen payload={thumbs[s]!} /></div> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-semibold text-forest">{STATE_LABELS[s].title}</p>
                <p className="text-sm text-ink-muted">{STATE_LABELS[s].body}</p>
              </div>
              {live === s && <Tag>On TV now</Tag>}
              <Icon name="chevron-right" size={18} className="text-ink-muted" />
            </button>
          ))}
          <p className="px-1 text-xs text-ink-muted">The preview is close to the TV, not exact: fonts and photos can look slightly different there.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {active === "arriving" && (
          <Section icon="home" title="Welcome message" description="What guests see during their stay.">
            <div className="space-y-4">
              <Field label="Title" optional hint={'Leave empty for "Welcome, {name}!". {name} becomes the guest’s first name.'}>{(id, d) => <Input id={id} value={draft.welcome_title} onChange={(e) => set("welcome_title", e.target.value)} maxLength={80} placeholder="Welcome, {name}!" aria-describedby={d} />}</Field>
              <Field label="Note" optional hint="1–2 short lines.">{(id, d) => <Textarea id={id} value={draft.welcome_note} onChange={(e) => set("welcome_note", e.target.value)} maxLength={240} rows={3} placeholder="Make yourself at home. If you need anything, message us on WhatsApp." aria-describedby={d} />}</Field>
            </div>
          </Section>
        )}
        {active === "checkout" && (
          <>
            <Section icon="door" title="Before you leave" description={`The steps on check-out morning (check-out is ${property.checkout_time}; change it under Properties).`}>
              <SortableList items={steps} max={6} addLabel="Add a step" onAdd={() => set("checkout_steps", [...steps, ""])} onChange={(v) => set("checkout_steps", v)}
                render={(s, _i, update) => <Input value={s} onChange={(e) => update(e.target.value)} maxLength={80} placeholder="e.g. Leave the keys on the table" aria-label="Step" />} />
            </Section>
            <Section icon="mail" title="Thank-you and contact">
              <div className="space-y-4">
                <Field label="Thank-you line at the bottom" optional>{(id) => <Input id={id} value={draft.thankyou_line} onChange={(e) => set("thankyou_line", e.target.value)} maxLength={120} placeholder={`Thank you for staying at ${property.name}!`} />}</Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Contact title" optional>{(id) => <Input id={id} value={draft.contact_title} onChange={(e) => set("contact_title", e.target.value)} maxLength={60} placeholder="Safe travels!" />}</Field>
                  <Field label="Contact line" optional>{(id) => <Input id={id} value={draft.contact_line} onChange={(e) => set("contact_line", e.target.value)} maxLength={140} placeholder="Message us on Airbnb if you left anything." />}</Field>
                </div>
              </div>
            </Section>
          </>
        )}
        {active === "between" && (
          <Section icon="sun" title="No-booking message" description="Shown when nobody is booked.">
            <div className="space-y-4">
              <Field label="Title" optional hint={`Leave empty for "Welcome to ${property.name}".`}>{(id, d) => <Input id={id} value={draft.generic_title} onChange={(e) => set("generic_title", e.target.value)} maxLength={80} aria-describedby={d} />}</Field>
              <Field label="Note" optional>{(id) => <Textarea id={id} value={draft.generic_note} onChange={(e) => set("generic_note", e.target.value)} maxLength={240} rows={3} placeholder={property.tagline || "2-bed · Ocean view · Fast Wi-Fi"} />}</Field>
            </div>
          </Section>
        )}
        <Section icon="image" title="Photo" description="Upload a normal landscape photo: the TV crops and darkens it to fit the layout. Resized before upload.">
          <PhotoSlot property={property} field={STATE_LABELS[active].photo as "photo_welcome"} label={`On "${STATE_LABELS[active].title.toLowerCase()}"`} />
        </Section>
      </div>

      <Section icon="sparkle" title="Look" description="The layout and colours of every screen on this property's TVs.">
        <p className="kb-label">Layout</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {LAYOUTS.map((l) => (
            <button key={l.value} type="button" onClick={() => set("layout", l.value)} aria-pressed={draft.layout === l.value}
              className={`rounded-md border-2 p-2 text-left transition-colors ${draft.layout === l.value ? "border-forest bg-mint-soft" : "border-line hover:border-line-strong"}`}>
              <LayoutThumb layout={l.value} bg={look.bg} accent={look.accent} />
              <span className="mt-2 block text-sm font-semibold">{l.label}</span>
              <span className="block text-xs text-ink-muted">{l.desc}</span>
            </button>
          ))}
        </div>
        <p className="kb-label mt-6">Colours</p>
        <div className="flex flex-wrap gap-2">
          {allThemes.map((t) => (
            <button key={t.key} type="button" aria-pressed={theme === t.key}
              onClick={() => { set("theme", t.key as ThemeName); if (t.key === "custom" && !hexOk(draft.color_bg)) { set("color_bg", "#2a0c13"); set("color_accent", "#f2b85c"); } }}
              className={`flex w-24 flex-col items-center gap-1.5 rounded-md border-2 px-2 py-2.5 ${theme === t.key ? "border-forest bg-mint-soft" : "border-line hover:border-line-strong"}`}>
              <span className="flex h-9 w-14 items-center justify-end rounded-sm px-2" style={{ background: t.bg }}><span className="h-3.5 w-3.5 rounded-full" style={{ background: t.accent }} /></span>
              <span className="text-center text-xs font-semibold leading-tight">{t.label}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          {(["color_bg", "color_accent"] as const).map((k) => {
            const value = custom ? draft[k] : k === "color_bg" ? look.bg : look.accent;
            return (
              <label key={k} className="flex items-center gap-3 rounded-md border border-line px-3 py-2">
                <input type="color" value={hexOk(value) ? value : "#000000"} onChange={(e) => { if (!custom) { set("theme", "custom"); set(k === "color_bg" ? "color_accent" : "color_bg", k === "color_bg" ? look.accent : look.bg); } set(k, e.target.value); }}
                  className="h-9 w-10 cursor-pointer rounded-sm border border-line-strong" aria-label={k === "color_bg" ? "Background colour" : "Highlight colour"} />
                <span><span className="block text-sm font-semibold">{k === "color_bg" ? "Background" : "Highlight"}</span><span className="block font-mono text-xs uppercase text-ink-muted">{value}</span></span>
              </label>
            );
          })}
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section icon="star" title={<span className="inline-flex items-center gap-2">Logo {!plan.pro && <ProTag />}</span>} description="Your stay's or brand's logo on every screen. A PNG with a transparent background looks best.">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-16 w-32 items-center justify-center rounded-md p-2" style={{ background: look.bg }}>
              {logoBusy ? <Spinner className="text-white" /> : property.logo ? <img src={mediaUrl(property.logo)} alt="Your logo" className="max-h-full max-w-full object-contain" /> : <Icon name="image" className="text-white/60" />}
            </div>
            {plan.pro ? (
              <>
                <input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="sr-only" id="logo-in" onChange={(e) => uploadLogo(e.target.files?.[0])} />
                <label htmlFor="logo-in" className="kb-btn kb-btn--secondary kb-btn--sm cursor-pointer"><Icon name="upload" size={16} />{property.logo ? "Replace" : "Upload logo"}</label>
                {property.logo && <Button variant="ghost" size="sm" onClick={() => save({ logo: "" }, "Logo removed.")}>Remove</Button>}
              </>
            ) : <Button variant="secondary" size="sm" icon="upload" onClick={() => openUpgrade("Show your own logo on the TV with Pro.")}>Upload logo</Button>}
          </div>
          {plan.pro && property.logo && (
            <div className="mt-4"><Segmented label="Logo position" value={draft.logo_position} onChange={(v) => set("logo_position", v)} options={[{ value: "header", label: "Top of screen" }, { value: "wifi", label: "In the Wi-Fi card" }]} /></div>
          )}
        </Section>
        <Section icon="sun" title={<span className="inline-flex items-center gap-2">Weather {!plan.pro && <ProTag />}</span>} description="The forecast for your area under the Wi-Fi card: now, today and the next three days.">
          <Toggle checked={draft.weather_enabled} onChange={(v) => (v && !plan.pro ? openUpgrade("Weather on the TV is a Pro feature.") : set("weather_enabled", v))}
            label="Show the weather on the TV" description="Updated every hour from MET Norway." />
          {draft.weather_enabled && (
            <Field label="Place" className="mt-4" hint={property.weather_json ? `Found. Last updated ${property.weather_at ? new Date(property.weather_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}.` : "Town and country, e.g. Diani Beach, Kenya."}>
              {(id, d) => <Input id={id} value={draft.weather_place} onChange={(e) => set("weather_place", e.target.value)} maxLength={120} placeholder={property.area ? `${property.area}, Kenya` : "Diani Beach, Kenya"} aria-describedby={d} />}
            </Field>
          )}
        </Section>
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={onSave} onDiscard={reset} valid={valid} />
    </div>
  );
}

function MiniScreen({ payload }: { payload: ScreenPayload }) { return <WelcomeScreen payload={payload} />; }

export default function Screens() {
  const { selected } = useData();
  return (
    <div>
      <PageHeader title={<span className="flex items-center gap-3"><Icon name="tv" size={28} />TV Screens</span>} subtitle="Create and customise the welcome screens on your TVs." actions={<PropertySwitcher />} />
      {selected ? <Editor key={selected.id} property={selected} /> : <Card><EmptyState icon="building" title="Add a property first" action={<ButtonLink to="/app/properties">Add property</ButtonLink>} /></Card>}
    </div>
  );
}
