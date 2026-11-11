import type { Cleaning, HouseRule, Property } from "@/lib/types";
import { DAYS, cleaningSummary } from "@/lib/cleaning";
import { Icon } from "@/components/Icons";
import { Button, ButtonLink, Card, EmptyState, Field, Input, PageHeader, Select, Toggle } from "@/components/ui";
import { useData } from "./data";
import { SaveBar, Section, SortableList, TIME_RE, usePropertyDraft, useSaveProperty } from "./shared/editing";
import { IconPicker, PropertySwitcher } from "./shared/widgets";

const PRESETS: HouseRule[] = [
  { icon: "no-smoking", text: "No smoking" },
  { icon: "no-parties", text: "No parties" },
  { icon: "no-pets", text: "No pets" },
  { icon: "shoes", text: "Shoes off indoors" },
  { icon: "key", text: "Lock the door when you go out" },
  { icon: "bulb", text: "Switch off lights when you leave" },
];

function RulesEditor({ property }: { property: Property }) {
  const { draft, set, dirty, reset } = usePropertyDraft(property, ["house_rules", "max_guests", "quiet_start", "quiet_end", "cleaning", "show_cleaning"]);
  const { save, saving } = useSaveProperty(property);
  const rules = draft.house_rules || [];
  const quietErr = (draft.quiet_start || draft.quiet_end) && !(TIME_RE.test(draft.quiet_start) && TIME_RE.test(draft.quiet_end)) ? "Set both times, or clear both to hide quiet hours." : "";
  const unused = PRESETS.filter((p) => !rules.some((r) => r.text === p.text));
  const cleaning = draft.cleaning || [];
  const cleanErr = cleaning.some((c) => !TIME_RE.test(c.time)) ? "Give every visit a time." : "";
  return (
    <div className="space-y-6">
      <Section icon="clipboard" title="House rules" description="Up to 6, shown as pills along the bottom of the TV. Keep them short.">
        <SortableList items={rules} max={6} addLabel="Add a rule" onAdd={() => set("house_rules", [...rules, { icon: "info", text: "" }])} onChange={(v) => set("house_rules", v)}
          render={(r, _i, update) => (
            <div className="flex items-center gap-2">
              <IconPicker value={r.icon} onChange={(icon) => update({ ...r, icon })} />
              <Input value={r.text} onChange={(e) => update({ ...r, text: e.target.value })} maxLength={40} placeholder="e.g. No smoking" aria-label="Rule text" />
            </div>
          )} />
        {rules.length < 6 && unused.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-ink-muted">Quick add:</span>
            {unused.map((p) => <button key={p.text} type="button" onClick={() => set("house_rules", [...rules, p])} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm hover:bg-mint-soft"><Icon name={p.icon} size={16} />{p.text}</button>)}
          </div>
        )}
      </Section>
      <Section icon="guests" title="Guests and quiet hours" description="Shown next to the house rules.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Max guests" optional>{(id) => <Input id={id} type="number" min={0} max={99} inputMode="numeric" value={draft.max_guests || ""} onChange={(e) => set("max_guests", Math.max(0, Math.min(99, parseInt(e.target.value, 10) || 0)))} placeholder="4" />}</Field>
          <Field label="Quiet from" optional error={quietErr}>{(id) => <Input id={id} type="time" value={draft.quiet_start} onChange={(e) => set("quiet_start", e.target.value)} />}</Field>
          <Field label="Quiet until" optional>{(id) => <Input id={id} type="time" value={draft.quiet_end} onChange={(e) => set("quiet_end", e.target.value)} />}</Field>
        </div>
        {(draft.quiet_start || draft.quiet_end) && <Button variant="ghost" size="sm" className="mt-2" onClick={() => { set("quiet_start", ""); set("quiet_end", ""); }}>Clear quiet hours</Button>}
      </Section>
      <Section icon="broom" title="Cleaning schedule" description="When housekeeping visits. Guests see it on the TV, so nobody is surprised by a knock on the door.">
        <SortableList<Cleaning> items={cleaning} max={7} addLabel="Add a visit" onAdd={() => set("cleaning", [...cleaning, { day: "tue", time: "10:00", note: "" }])} onChange={(v) => set("cleaning", v)}
          render={(c, _i, update) => (
            <div className="grid gap-2 sm:grid-cols-[9rem_7.5rem_1fr]">
              <Select value={c.day} onChange={(e) => update({ ...c, day: e.target.value as Cleaning["day"] })} aria-label="Day">{DAYS.map((d) => <option key={d.key} value={d.key}>{d.long}</option>)}</Select>
              <Input type="time" value={c.time} onChange={(e) => update({ ...c, time: e.target.value })} aria-label="Time" />
              <Input value={c.note} onChange={(e) => update({ ...c, note: e.target.value })} maxLength={60} placeholder="e.g. Fresh towels and bedding" aria-label="What happens" />
            </div>
          )} />
        {cleanErr && <p className="kb-error">{cleanErr}</p>}
        {cleaning.length > 0 && <p className="mt-4 rounded-md bg-mint-soft px-4 py-3 text-sm"><b>On the TV:</b> Housekeeping {cleaningSummary(cleaning)}</p>}
        <div className="mt-4 border-t border-line pt-4"><Toggle checked={draft.show_cleaning !== false} onChange={(v) => set("show_cleaning", v)} label="Show the schedule on the TV" description="Also listed on the guest phone page." /></div>
      </Section>
      <p className="text-sm text-ink-muted">Check-out steps live on <a href="/app/screens" className="font-semibold text-green underline">TV Screens → Check-out day</a>.</p>
      <SaveBar dirty={dirty} saving={saving} valid={!quietErr && !cleanErr} onDiscard={reset}
        onSave={() => save({ house_rules: rules.filter((r) => r.text.trim()).map((r) => ({ icon: r.icon, text: r.text.trim() })), max_guests: Number(draft.max_guests) || 0, quiet_start: draft.quiet_start, quiet_end: draft.quiet_end,
          cleaning: cleaning.map((c) => ({ day: c.day, time: c.time, note: c.note.trim() })), show_cleaning: draft.show_cleaning !== false })} />
    </div>
  );
}

export default function Rules() {
  const { selected } = useData();
  return (
    <div>
      <PageHeader title={<span className="flex items-center gap-3"><Icon name="clipboard" size={28} />House Rules</span>} subtitle="Rules, quiet hours and housekeeping, on the TV before anyone asks." actions={<PropertySwitcher />} />
      {selected ? <RulesEditor key={selected.id} property={selected} /> : <Card><EmptyState icon="building" title="Add a property first" action={<ButtonLink to="/app/properties">Add property</ButtonLink>} /></Card>}
    </div>
  );
}
