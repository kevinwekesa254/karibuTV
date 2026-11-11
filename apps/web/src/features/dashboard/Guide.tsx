import { useMemo } from "react";
import type { Extra, Pick, Property } from "@/lib/types";
import { Icon } from "@/components/Icons";
import { ButtonLink, Card, EmptyState, Field, Input, PageHeader } from "@/components/ui";
import { RoomMockup, guideUrl } from "@/features/tv/WelcomeScreen";
import { useData } from "./data";
import { SaveBar, Section, SortableList, usePropertyDraft, useSaveProperty } from "./shared/editing";
import { PropertySwitcher, usePreview } from "./shared/widgets";

const EXTRA_IDEAS: Extra[] = [
  { title: "Airport transfer", price: "" },
  { title: "Late check-out", price: "" },
  { title: "Breakfast basket", price: "" },
  { title: "Day trip / safari", price: "" },
  { title: "Extra cleaning", price: "" },
  { title: "Private chef dinner", price: "" },
];

const URL_RE = /^https?:\/\/\S+$/i;

function GuideEditor({ property }: { property: Property }) {
  const { draft, set, dirty, reset } = usePropertyDraft(property, ["picks", "extras", "review_url"]);
  const { save, saving } = useSaveProperty(property);
  const picks = draft.picks || [];
  const extras = draft.extras || [];
  const overrides = useMemo(() => ({ picks, extras, review_url: draft.review_url }), [picks, extras, draft.review_url]);
  const arriving = usePreview(property, { state: "arriving", overrides }).payload;
  const checkout = usePreview(property, { state: "checkout", overrides }).payload;
  const reviewErr = draft.review_url && !URL_RE.test(draft.review_url.trim()) ? "Paste the full link, starting with https://" : "";
  const pickErr = picks.some((p) => p.url && !URL_RE.test(p.url.trim()));
  const unusedExtras = EXTRA_IDEAS.filter((e) => !extras.some((x) => x.title === e.title));

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <div className="space-y-6">
        <Section icon="star" title="Reviews on check-out day" description="On check-out day the TV asks “Loved your stay?” with a QR code to your review page. More five-star reviews, without the awkward ask.">
          <Field label="Review link" optional error={reviewErr} hint="Your Airbnb listing link, or a Google review link. Leave empty to show the Wi-Fi card instead.">
            {(id) => <Input id={id} type="url" inputMode="url" value={draft.review_url} onChange={(e) => set("review_url", e.target.value)} placeholder="https://www.airbnb.com/rooms/…" />}
          </Field>
        </Section>

        <Section icon="pin" title="Your local picks" description="Up to 6 places you love: a beach, a restaurant, a trusted taxi. The TV shows the top 3 and a QR code to the full guide on the guest's phone.">
          <SortableList<Pick> items={picks} max={6} addLabel="Add a pick" onAdd={() => set("picks", [...picks, { title: "", note: "", url: "" }])} onChange={(v) => set("picks", v)}
            render={(x, _i, update) => (
              <div className="grid gap-2 sm:grid-cols-2">
                <Input value={x.title} onChange={(e) => update({ ...x, title: e.target.value })} maxLength={40} placeholder="e.g. Ali Barbour's Cave" aria-label="Place name" />
                <Input value={x.note} onChange={(e) => update({ ...x, note: e.target.value })} maxLength={50} placeholder="e.g. Dinner in a coral cave · 10 min" aria-label="Short note" />
                <Input className="sm:col-span-2" value={x.url} onChange={(e) => update({ ...x, url: e.target.value })} maxLength={300} placeholder="Link (optional). Without one, guests get Google Maps directions." aria-label="Link" aria-invalid={!!x.url && !URL_RE.test(x.url.trim())} />
              </div>
            )} />
        </Section>

        <Section icon="sparkle" title="Extras guests can request" description="Things you can arrange for a fee. Guests tap “Request” on their phone and it opens WhatsApp to you with the request written out. You confirm and take payment as you do today.">
          <SortableList<Extra> items={extras} max={6} addLabel="Add an extra" onAdd={() => set("extras", [...extras, { title: "", price: "" }])} onChange={(v) => set("extras", v)}
            render={(x, _i, update) => (
              <div className="grid gap-2 sm:grid-cols-[1fr_11rem]">
                <Input value={x.title} onChange={(e) => update({ ...x, title: e.target.value })} maxLength={40} placeholder="e.g. Airport transfer" aria-label="Extra" />
                <Input value={x.price} onChange={(e) => update({ ...x, price: e.target.value })} maxLength={24} placeholder="KES 3,500" aria-label="Price" />
              </div>
            )} />
          {extras.length < 6 && unusedExtras.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-sm text-ink-muted">Ideas:</span>
              {unusedExtras.map((e) => <button key={e.title} type="button" onClick={() => set("extras", [...extras, e])} className="rounded-full border border-line px-3 py-1.5 text-sm hover:bg-sun-soft">{e.title}</button>)}
            </div>
          )}
          {!property.host_contact && <p className="mt-4 rounded-md bg-sun-soft px-4 py-3 text-sm text-sun-ink">Add your WhatsApp number under <a className="font-semibold underline" href={`/app/properties/${property.id}`}>Property details</a> so guests can send requests.</p>}
        </Section>

        <SaveBar dirty={dirty} saving={saving} valid={!reviewErr && !pickErr} onDiscard={reset}
          onSave={() => save({
            review_url: draft.review_url.trim(),
            picks: picks.filter((p) => p.title.trim()).map((p) => ({ title: p.title.trim(), note: p.note.trim(), url: p.url.trim() })),
            extras: extras.filter((x) => x.title.trim()).map((x) => ({ title: x.title.trim(), price: x.price.trim() })),
          })} />
      </div>

      <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
        <div>
          <p className="kb-eyebrow mb-2">During the stay</p>
          {arriving && <RoomMockup payload={arriving} className="shadow-card" />}
        </div>
        <div>
          <p className="kb-eyebrow mb-2">Check-out day</p>
          {checkout && <RoomMockup payload={checkout} className="shadow-card" />}
        </div>
        <Card className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0"><p className="font-semibold">Guest phone page</p><p className="truncate text-sm text-ink-muted">What guests see after scanning</p></div>
          <a className="kb-btn kb-btn--secondary kb-btn--sm" href={guideUrl(property.id)} target="_blank" rel="noreferrer">Open<Icon name="arrow-right" size={16} /></a>
        </Card>
      </aside>
    </div>
  );
}

export default function Guide() {
  const { selected } = useData();
  return (
    <div>
      <PageHeader title={<span className="flex items-center gap-3"><Icon name="pin" size={28} />Guide & Extras</span>}
        subtitle="Local tips, paid extras and a review prompt. Small touches that earn five stars." actions={<PropertySwitcher />} />
      {selected ? <GuideEditor key={selected.id} property={selected} /> : <Card><EmptyState icon="building" title="Add a property first" action={<ButtonLink to="/app/properties">Add property</ButtonLink>} /></Card>}
    </div>
  );
}
