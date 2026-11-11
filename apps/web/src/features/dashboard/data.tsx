import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Device, Property } from "@/lib/types";

const SELECTED_KEY = "karibu_selected_property";

interface DataCtx {
  properties: Property[];
  devices: Device[];
  loading: boolean;
  /** The property the TV Screens / Wi-Fi / Rules / Integrations pages are editing. */
  selected: Property | undefined;
  selectProperty: (id: string) => void;
  reloadProperties: () => Promise<Property[]>;
  reloadDevices: () => Promise<void>;
  upsertProperty: (p: Property) => void;
  /** Bumped whenever bookings change, so lists and previews refresh. */
  staysVersion: number;
  bumpStays: () => void;
  openUpgrade: (reason?: string) => void;
  upgradeReason: string | null;
  closeUpgrade: () => void;
}

const Ctx = createContext<DataCtx | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>(() => { try { return localStorage.getItem(SELECTED_KEY) || ""; } catch { return ""; } });
  const [staysVersion, setStaysVersion] = useState(0);
  const [upgradeReason, setUpgradeReason] = useState<string | null>(null);

  const reloadProperties = useCallback(async () => {
    const { data, error } = await supabase.from("properties").select("*").order("created_at");
    if (error) throw error;
    setProperties(data as Property[]);
    return data as Property[];
  }, []);
  const reloadDevices = useCallback(async () => {
    const { data } = await supabase.from("devices").select("*").order("created_at");
    setDevices((data as Device[]) || []);
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([reloadProperties(), reloadDevices()]).catch(() => {}).finally(() => setLoading(false));
    const ch = supabase.channel(`host-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "devices", filter: `owner_id=eq.${user.id}` }, () => { reloadDevices(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "stays" }, () => setStaysVersion((v) => v + 1))
      .subscribe();
    const t = window.setInterval(() => reloadDevices(), 60_000);
    return () => { window.clearInterval(t); supabase.removeChannel(ch); };
  }, [user?.id, reloadProperties, reloadDevices]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = properties.find((p) => p.id === selectedId) || properties[0];

  const value = useMemo<DataCtx>(() => ({
    properties, devices, loading, selected,
    selectProperty: (id) => { setSelectedId(id); try { localStorage.setItem(SELECTED_KEY, id); } catch { /* ignore */ } },
    reloadProperties, reloadDevices,
    upsertProperty: (p) => setProperties((list) => (list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [...list, p])),
    staysVersion, bumpStays: () => setStaysVersion((v) => v + 1),
    openUpgrade: (reason) => setUpgradeReason(reason || "Unlock Pro features"),
    upgradeReason, closeUpgrade: () => setUpgradeReason(null),
  }), [properties, devices, loading, selected, reloadProperties, reloadDevices, staysVersion, upgradeReason]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useData outside DataProvider");
  return c;
}
