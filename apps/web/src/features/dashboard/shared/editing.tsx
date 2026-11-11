import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase, errorMessage, errorCode } from "@/lib/supabase";
import { useToast, SAVED } from "@/lib/toast";
import type { Property } from "@/lib/types";
import { Button, Card } from "@/components/ui";
import { Icon } from "@/components/Icons";
import { useData } from "../data";

/** Draft state for a subset of a property's fields, with save/discard. */
export function usePropertyDraft<K extends keyof Property>(property: Property, keys: K[]) {
  const pick = () => Object.fromEntries(keys.map((k) => [k, clone(property[k])])) as Pick<Property, K>;
  const [draft, setDraft] = useState<Pick<Property, K>>(pick);
  const base = useMemo(pick, [property]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setDraft(pick()); }, [property.id, property.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(draft) !== JSON.stringify(base);
  const set = <F extends K>(k: F, v: Property[F]) => setDraft((d) => ({ ...d, [k]: v }));
  return { draft, setDraft, set, dirty, reset: () => setDraft(pick()) };
}

function clone<T>(v: T): T { return v && typeof v === "object" ? JSON.parse(JSON.stringify(v)) : v; }

export function useSaveProperty(property: Property) {
  const { upsertProperty, openUpgrade } = useData();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const save = async (data: Partial<Property>, okMsg: string | null = SAVED) => {
    setSaving(true);
    try {
      const { data: rec, error } = await supabase.from("properties").update(data).eq("id", property.id).select("*").single();
      if (error) throw error;
      upsertProperty(rec as Property);
      if (okMsg) toast(okMsg);
      return rec as Property;
    } catch (err) {
      if (errorCode(err) === "pro_required" || errorCode(err) === "plan_limit") openUpgrade(errorMessage(err));
      else toast(errorMessage(err), "error");
      return null;
    } finally { setSaving(false); }
  };
  return { save, saving };
}

export function SaveBar({ dirty, saving, onSave, onDiscard, valid = true }: { dirty: boolean; saving: boolean; onSave: () => void; onDiscard: () => void; valid?: boolean }) {
  if (!dirty) return null;
  return (
    <div className="sticky bottom-20 z-20 mt-6 lg:bottom-4">
      <div className="flex items-center justify-between gap-3 rounded-full border border-line bg-surface py-2 pl-5 pr-2 shadow-panel">
        <span className="text-sm font-medium text-ink">Unsaved changes</span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onDiscard} disabled={saving}>Discard</Button>
          <Button size="sm" onClick={onSave} loading={saving} disabled={!valid}>Save changes</Button>
        </div>
      </div>
    </div>
  );
}

export function Section({ title, description, children, aside, icon }: { title: ReactNode; description?: ReactNode; children: ReactNode; aside?: ReactNode; icon?: string }) {
  return (
    <Card as="section" className="p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          {icon && <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-mint-soft text-forest"><Icon name={icon} size={20} /></span>}
          <div>
          <h2 className="font-display text-xl font-semibold text-forest">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
          </div>
        </div>
        {aside}
      </div>
      {children}
    </Card>
  );
}

/** Ordered list editor with up/down buttons and drag to reorder. */
export function SortableList<T>({ items, onChange, render, max, addLabel, onAdd }: {
  items: T[]; onChange: (v: T[]) => void; render: (item: T, i: number, update: (v: T) => void) => ReactNode; max: number; addLabel: string; onAdd: () => void;
}) {
  const dragFrom = useRef<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = items.slice();
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    onChange(next);
  };
  return (
    <div>
      <ol className="space-y-2">
        {items.map((item, i) => (
          <li key={i} draggable onDragStart={() => (dragFrom.current = i)} onDragOver={(e) => { e.preventDefault(); setOver(i); }}
            onDragLeave={() => setOver(null)} onDrop={() => { if (dragFrom.current !== null) move(dragFrom.current, i); dragFrom.current = null; setOver(null); }}
            className={`flex items-center gap-2 rounded-md border bg-surface p-2 ${over === i ? "border-green" : "border-line"}`}>
            <span className="hidden cursor-grab px-1 text-ink-muted sm:block" aria-hidden><Icon name="drag" size={18} /></span>
            <span className="w-6 shrink-0 text-center font-display font-semibold text-ink-muted">{i + 1}</span>
            <div className="min-w-0 flex-1">{render(item, i, (v) => onChange(items.map((x, j) => (j === i ? v : x))))}</div>
            <div className="flex shrink-0">
              <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className="rounded-full p-2 text-ink-muted hover:bg-mint-soft disabled:opacity-30" aria-label="Move up"><Icon name="arrow-up" size={16} /></button>
              <button type="button" onClick={() => move(i, i + 1)} disabled={i === items.length - 1} className="rounded-full p-2 text-ink-muted hover:bg-mint-soft disabled:opacity-30" aria-label="Move down"><Icon name="arrow-down" size={16} /></button>
              <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="rounded-full p-2 text-danger hover:bg-danger/10" aria-label="Remove"><Icon name="x" size={16} /></button>
            </div>
          </li>
        ))}
      </ol>
      {items.length < max ? (
        <Button variant="secondary" size="sm" icon="plus" onClick={onAdd} className="mt-3">{addLabel}</Button>
      ) : <p className="mt-3 text-sm text-ink-muted">Maximum of {max} reached, so everything fits on the TV.</p>}
    </div>
  );
}

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
