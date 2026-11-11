import { useEffect, useState, type FormEvent } from "react";
import { supabase, errorMessage, errorCode } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import type { Property } from "@/lib/types";
import { Button, ErrorBanner, Field, Input, Select } from "@/components/ui";
import { useData } from "../data";

const ALPHABET = /[^ABCDEFGHJKMNPQRSTUVWXYZ23456789]/g;
// Codes never contain 0/O/1/I/L, so anything outside the alphabet (spaces, dashes) is dropped.
export const normaliseCode = (v: string) => v.toUpperCase().replace(ALPHABET, "").slice(0, 6);
const display = (c: string) => (c.length > 3 ? `${c.slice(0, 3)} ${c.slice(3)}` : c);

const ROOMS = ["Living room", "Bedroom", "Master bedroom", "Lounge", "Kitchen"];

export function PairTvForm({ properties, initialCode = "", defaultProperty, onPaired }: { properties: Property[]; initialCode?: string; defaultProperty?: string; onPaired: () => void }) {
  const toast = useToast();
  const { openUpgrade } = useData();
  const [code, setCode] = useState(normaliseCode(initialCode));
  const [property, setProperty] = useState(defaultProperty || properties[0]?.id || "");
  const [name, setName] = useState("Living room");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (initialCode) setCode(normaliseCode(initialCode)); }, [initialCode]);
  useEffect(() => { if (!property && properties[0]) setProperty(properties[0].id); }, [properties, property]);

  const codeErr = code.length !== 6 ? "The code has 6 letters and numbers, like K7Q 4MZ." : "";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (codeErr || !property) return;
    setSaving(true); setError("");
    try {
      const { error } = await supabase.rpc("pair_link", { p_code: code, p_property: property, p_name: name.trim() || "TV" });
      if (error) throw error;
      toast("Paired! The TV switches to the welcome screen in a few seconds.");
      setCode("");
      onPaired();
    } catch (err) {
      if (errorCode(err) === "plan_limit") openUpgrade(errorMessage(err));
      else setError(errorMessage(err));
    } finally { setSaving(false); }
  };

  if (!properties.length) return <p className="text-sm text-ink-muted">Add a property first, then pair its TV.</p>;

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && <ErrorBanner>{error}</ErrorBanner>}
      <Field label="Code on the TV" error={touched ? codeErr : ""} hint="Open Karibu TV on the TV to see the code.">
        {(id, d) => (
          <Input id={id} value={display(code)} onChange={(e) => setCode(normaliseCode(e.target.value))} onBlur={() => code && setTouched(true)}
            inputMode="text" autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="K7Q 4MZ" aria-describedby={d}
            invalid={touched && !!codeErr} className="!py-3 text-center font-display !text-3xl font-semibold tracking-[0.2em]" />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Property">{(id) => (
          <Select id={id} value={property} onChange={(e) => setProperty(e.target.value)}>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        )}</Field>
        <Field label="Room">{(id) => (
          <>
            <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} list={`${id}-rooms`} />
            <datalist id={`${id}-rooms`}>{ROOMS.map((r) => <option key={r} value={r} />)}</datalist>
          </>
        )}</Field>
      </div>
      <Button type="submit" size="lg" className="w-full sm:w-auto" loading={saving} icon="link">Pair TV</Button>
    </form>
  );
}
