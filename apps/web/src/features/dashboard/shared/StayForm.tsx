import { useEffect, useState, type FormEvent } from "react";
import { supabase, errorMessage } from "@/lib/supabase";
import { useToast, SAVED } from "@/lib/toast";
import { addDays, dateOnly, nightsBetween, todayIn } from "@/lib/dates";
import type { Property, Stay } from "@/lib/types";
import { Button, ConfirmModal, ErrorBanner, Field, Input, Modal, Select, Textarea, Tag } from "@/components/ui";

export function StayForm({ open, onClose, onSaved, stay, properties, defaultProperty }: {
  open: boolean; onClose: () => void; onSaved: () => void; stay?: Stay | null; properties: Property[]; defaultProperty?: string;
}) {
  const toast = useToast();
  const [f, setF] = useState({ property: "", first_name: "", checkin: "", checkout: "", note: "" });
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prop = stay?.property_id || defaultProperty || properties[0]?.id || "";
    const tz = properties.find((p) => p.id === prop)?.timezone;
    const today = todayIn(tz);
    setF(stay
      ? { property: stay.property_id, first_name: stay.first_name, checkin: dateOnly(stay.checkin), checkout: dateOnly(stay.checkout), note: stay.note }
      : { property: prop, first_name: "", checkin: today, checkout: addDays(today, 2), note: "" });
    setTouched(false); setError("");
  }, [open, stay, defaultProperty, properties]);

  const nights = f.checkin && f.checkout ? nightsBetween(f.checkin, f.checkout) : 0;
  const errs = {
    property: !f.property ? "Choose a property." : "",
    checkin: !f.checkin ? "Pick the check-in date." : "",
    checkout: !f.checkout ? "Pick the check-out date." : nights <= 0 ? "Check-out must be after check-in." : nights > 365 ? "Stays can be up to a year." : "",
    first_name: f.first_name.length > 40 ? "Keep it under 40 characters." : "",
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (Object.values(errs).some(Boolean)) return;
    setSaving(true); setError("");
    const data = { property_id: f.property, first_name: f.first_name.trim(), checkin: f.checkin, checkout: f.checkout, note: f.note.trim() };
    try {
      const { error } = stay
        ? await supabase.from("stays").update(data).eq("id", stay.id)
        : await supabase.from("stays").insert({ ...data, source: "manual", cancelled: false });
      if (error) throw error;
      toast(SAVED);
      onSaved(); onClose();
    } catch (err) { setError(errorMessage(err)); }
    finally { setSaving(false); }
  };

  const del = async () => {
    if (!stay) return;
    setSaving(true);
    try { const { error } = await supabase.from("stays").delete().eq("id", stay.id); if (error) throw error; toast("Booking deleted."); onSaved(); setConfirmDel(false); onClose(); }
    catch (err) { setError(errorMessage(err)); }
    finally { setSaving(false); }
  };

  return (
    <>
      <Modal open={open && !confirmDel} onClose={onClose} title={stay ? (stay.first_name ? `Edit ${stay.first_name}'s stay` : "Edit booking") : "Add a booking"}
        footer={<>
          {stay && <Button variant="danger" onClick={() => setConfirmDel(true)} className="mr-auto" icon="delete">Delete</Button>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="stay-form" loading={saving}>{stay ? "Save" : "Add booking"}</Button>
        </>}>
        <form id="stay-form" onSubmit={save} className="space-y-4" noValidate>
          {error && <ErrorBanner>{error}</ErrorBanner>}
          {stay?.source === "ical" && <p className="text-sm text-ink-muted"><Tag className="mr-2">From {stay.calendars?.label || "calendar"}</Tag>Dates come from your calendar. Add the guest's first name so the TV can greet them.</p>}
          {properties.length > 1 && (
            <Field label="Property" error={touched ? errs.property : ""}>{(id) => (
              <Select id={id} value={f.property} onChange={(e) => setF({ ...f, property: e.target.value })} disabled={stay?.source === "ical"}>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            )}</Field>
          )}
          <Field label="Guest's first name" optional hint="Only the first name is shown on the TV. Leave empty to greet without a name." error={touched ? errs.first_name : ""}>
            {(id, d) => <Input id={id} value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} maxLength={40} autoComplete="off" placeholder="e.g. Christine" aria-describedby={d} />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Check-in" error={touched ? errs.checkin : ""}>{(id) => <Input id={id} type="date" value={f.checkin} onChange={(e) => setF({ ...f, checkin: e.target.value, checkout: f.checkout && e.target.value >= f.checkout ? addDays(e.target.value, 1) : f.checkout })} disabled={stay?.source === "ical"} />}</Field>
            <Field label="Check-out" error={touched ? errs.checkout : ""}>{(id) => <Input id={id} type="date" value={f.checkout} min={f.checkin ? addDays(f.checkin, 1) : undefined} onChange={(e) => setF({ ...f, checkout: e.target.value })} disabled={stay?.source === "ical"} />}</Field>
          </div>
          {nights > 0 && <p className="-mt-2 text-sm text-ink-muted">{nights} night{nights === 1 ? "" : "s"}</p>}
          <Field label="Private note" optional hint="Only you see this. It's never shown on the TV.">
            {(id, d) => <Textarea id={id} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={500} rows={2} aria-describedby={d} />}
          </Field>
        </form>
      </Modal>
      <ConfirmModal open={confirmDel} onClose={() => setConfirmDel(false)} onConfirm={del} loading={saving} danger confirmLabel="Delete booking"
        title="Delete this booking?" body={stay?.source === "ical" ? "It will come back on the next calendar sync if it's still in your calendar." : "The TV will stop greeting this guest."} />
    </>
  );
}
