import { useState, type FormEvent } from "react";
import { Link, Navigate, NavLink, useNavigate, useParams } from "react-router-dom";
import { supabase, errorMessage, errorCode, mediaUrl } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { TIMEZONES } from "@/lib/dates";
import type { Property } from "@/lib/types";
import { phoneValid, splitPhone } from "@/lib/countries";
import { PhoneInput } from "@/components/PhoneInput";
import { AMENITIES, Icon } from "@/components/Icons";
import { Button, Card, ConfirmModal, EmptyState, ErrorBanner, Field, Input, Modal, PageHeader, Select } from "@/components/ui";
import { useData } from "./data";
import { SaveBar, Section, TIME_RE, usePropertyDraft, useSaveProperty } from "./shared/editing";

export const phoneOk = (v: string) => { if (!v) return true; const sp = splitPhone(v); return phoneValid(sp.country, sp.local); };

/** Defaults for a new property: sensible rules and check-out steps the host can edit. */
export function newPropertyDefaults(name: string, area: string, hostName: string, hostContact: string) {
  return {
    name, area, amenities: ["wifi", "tv", "hot-shower"],
    house_rules: [{ icon: "no-smoking", text: "No smoking" }, { icon: "no-parties", text: "No parties" }],
    checkout_steps: ["Switch off the AC, lights and other appliances", "Load used dishes in the sink", "Collect all your personal belongings", "Leave the keys on the table", "Close the door behind you"],
    host_name: hostName, host_contact: hostContact,
    contact_title: "Safe travels!",
  };
}

export function NewPropertyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useAuth();
  const { upsertProperty, openUpgrade, selectProperty } = useData();
  const toast = useToast();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Give the property a name."); return; }
    setSaving(true); setError("");
    try {
      const { data, error: err } = await supabase.from("properties")
        .insert(newPropertyDefaults(name.trim(), area.trim(), (profile?.name || "").split(" ")[0], profile?.whatsapp || "")).select("*").single();
      if (err) throw err;
      upsertProperty(data as Property);
      selectProperty((data as Property).id);
      toast("Property added.");
      onClose(); setName(""); setArea("");
      nav(`/app/properties/${(data as Property).id}`);
    } catch (err) {
      if (errorCode(err) === "plan_limit") { onClose(); openUpgrade(errorMessage(err)); }
      else setError(errorMessage(err));
    } finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Add a property"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="new-prop" loading={saving}>Add property</Button></>}>
      <form id="new-prop" onSubmit={submit} className="space-y-4" noValidate>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <Field label="Name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Serengeti Crib" />}</Field>
        <Field label="Area" optional>{(id) => <Input id={id} value={area} onChange={(e) => setArea(e.target.value)} maxLength={80} placeholder="Kilimani, Nairobi" />}</Field>
      </form>
    </Modal>
  );
}

export default function Properties() {
  const { properties, devices, openUpgrade, selectProperty } = useData();
  const { plan } = useAuth();
  const [open, setOpen] = useState(false);
  const add = () => (properties.length >= plan.maxProperties ? openUpgrade(plan.pro ? "You've reached the property limit." : "The Free plan includes 1 property. Upgrade to Pro to add more.") : setOpen(true));
  return (
    <div>
      <PageHeader title={<span className="flex items-center gap-3"><Icon name="building" size={28} />Properties</span>} subtitle={plan.pro ? `${properties.length} of ${plan.maxProperties} on your plan` : "Free plan: 1 property"} actions={<Button icon="plus" onClick={add}>Add property</Button>} />
      {!properties.length ? (
        <Card><EmptyState icon="building" title="No properties yet" body="Each property has its own Wi-Fi, rules, screen design and TVs." action={<Button onClick={add}>Add property</Button>} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {properties.map((p) => {
            const photo = p.photo_welcome || p.photo_generic;
            const tvs = devices.filter((d) => d.property_id === p.id).length;
            return (
              <Link key={p.id} to={`/app/properties/${p.id}`} onClick={() => selectProperty(p.id)} className="kb-card group overflow-hidden transition-shadow hover:shadow-panel">
                <div className="aspect-[16/9] bg-mint-soft">
                  {photo ? <img src={mediaUrl(photo)} alt="" className="h-full w-full object-cover" /> : <img src="/mockups/living-room.jpg" alt="" className="h-full w-full object-cover object-[50%_40%] opacity-90" />}
                </div>
                <div className="p-5">
                  <h2 className="font-display text-xl font-semibold text-forest group-hover:underline">{p.name}</h2>
                  <p className="text-sm text-ink-muted">{p.area || "—"}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-ink">
                    <span className="inline-flex items-center gap-1.5"><Icon name="tv" size={16} />{tvs} TV{tvs === 1 ? "" : "s"}</span>
                    <span className="inline-flex items-center gap-1.5"><Icon name="wifi" size={16} />{p.wifi_ssid ? "Wi-Fi set" : <span className="text-warning">No Wi-Fi yet</span>}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
      <NewPropertyModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

export function PropertyDetails() {
  const { id = "" } = useParams();
  const { properties } = useData();
  const property = properties.find((p) => p.id === id);
  if (!property) return <Navigate to="/app/properties" replace />;
  return <DetailsEditor key={property.id} property={property} />;
}

function DetailsEditor({ property }: { property: Property }) {
  const { draft, set, dirty, reset } = usePropertyDraft(property, ["name", "tagline", "area", "timezone", "checkin_time", "checkout_time", "amenities", "host_name", "host_contact"]);
  const { save, saving } = useSaveProperty(property);
  const { reloadProperties, selectProperty } = useData();
  const { profile } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [touched, setTouched] = useState(false);
  const amen = draft.amenities || [];
  const errs = {
    name: !draft.name.trim() ? "Give the property a name guests will recognise." : "",
    times: !TIME_RE.test(draft.checkin_time) || !TIME_RE.test(draft.checkout_time) ? "Use 24-hour times, e.g. 14:00." : "",
    phone: !phoneOk(draft.host_contact) ? "Check the number after the country code." : "",
  };
  const valid = !Object.values(errs).some(Boolean);
  const onSave = () => { setTouched(true); if (valid) save({ ...draft, name: draft.name.trim(), host_contact: draft.host_contact }); };
  const del = async () => {
    setDeleting(true);
    const { error } = await supabase.from("properties").delete().eq("id", property.id);
    if (error) { toast(errorMessage(error), "error"); setDeleting(false); return; }
    const left = await reloadProperties();
    if (left[0]) selectProperty(left[0].id);
    toast("Property deleted.");
    nav("/app/properties");
  };

  return (
    <div>
      <NavLink to="/app/properties" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-green"><Icon name="chevron-left" size={16} />Properties</NavLink>
      <PageHeader title={property.name} subtitle={[property.area, property.tagline].filter(Boolean).join(" · ") || undefined}
        actions={<>
          <Button variant="secondary" size="sm" icon="tv" onClick={() => { selectProperty(property.id); nav("/app/screens"); }}>TV screen</Button>
          <Button variant="secondary" size="sm" icon="wifi" onClick={() => { selectProperty(property.id); nav("/app/wifi"); }}>Wi-Fi</Button>
        </>} />
      <div className="space-y-5">
        <Section icon="building" title="Property" description="Shown at the top of the TV screen.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" error={touched ? errs.name : ""} className="sm:col-span-2">{(id) => <Input id={id} value={draft.name} onChange={(e) => set("name", e.target.value)} maxLength={80} />}</Field>
            <Field label="Tagline" optional hint="Shown when nobody is booked.">{(id, d) => <Input id={id} value={draft.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={120} aria-describedby={d} placeholder="2-bed · Ocean view · Fast Wi-Fi" />}</Field>
            <Field label="Area" optional>{(id) => <Input id={id} value={draft.area} onChange={(e) => set("area", e.target.value)} maxLength={80} placeholder="Diani Beach" />}</Field>
          </div>
        </Section>
        <Section icon="clock" title="Times" description="Check-out time decides when the TV switches to the check-out and next-guest screens.">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Check-in" error={touched ? errs.times : ""}>{(id) => <Input id={id} type="time" value={draft.checkin_time} onChange={(e) => set("checkin_time", e.target.value)} />}</Field>
            <Field label="Check-out">{(id) => <Input id={id} type="time" value={draft.checkout_time} onChange={(e) => set("checkout_time", e.target.value)} />}</Field>
            <Field label="Timezone">{(id) => <Select id={id} value={draft.timezone} onChange={(e) => set("timezone", e.target.value)}>{TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select>}</Field>
          </div>
        </Section>
        <Section icon="sparkle" title="Amenities" description="Up to 6 show on the TV, with icons.">
          <div className="flex flex-wrap gap-2">
            {AMENITIES.map((a) => {
              const on = amen.includes(a.key);
              return (
                <button key={a.key} type="button" aria-pressed={on} onClick={() => set("amenities", on ? amen.filter((x) => x !== a.key) : [...amen, a.key])}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${on ? "border-forest bg-mint text-on-mint" : "border-line bg-surface hover:border-line-strong"}`}>
                  <Icon name={a.key} size={18} />{a.label}{on && <Icon name="check" size={14} />}
                </button>
              );
            })}
          </div>
        </Section>
        <Section icon="phone" title="Host contact" description='Guests see "Need anything? WhatsApp {name}" on the TV.'>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Host first name" optional>{(id) => <Input id={id} value={draft.host_name} onChange={(e) => set("host_name", e.target.value)} maxLength={60} placeholder="Amina" />}</Field>
            <Field label="WhatsApp number" optional error={touched ? errs.phone : ""}>{(id) => <PhoneInput id={id} value={draft.host_contact} country={profile?.country} onChange={(v) => set("host_contact", v)} invalid={touched && !!errs.phone} />}</Field>
          </div>
        </Section>
        <Section icon="delete" title="Delete property" description="Removes its bookings, calendars and settings. Its TVs go back to the pairing screen.">
          <Button variant="danger" icon="delete" onClick={() => setConfirm(true)}>Delete {property.name}</Button>
        </Section>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={onSave} onDiscard={reset} />
      <ConfirmModal open={confirm} onClose={() => setConfirm(false)} onConfirm={del} loading={deleting} danger confirmLabel="Delete property"
        title={`Delete ${property.name}?`} body="This can't be undone. All bookings and calendar links for this property are deleted." />
    </div>
  );
}
