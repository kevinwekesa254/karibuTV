import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mediaUrl, tvClient } from "@/lib/supabase";
import { buildPayload } from "@/lib/screen";
import type { Property, ScreenPayload } from "@/lib/types";

export const APP_VERSION = "1.0.0";
const CACHE_KEY = "karibu_tv_screen";
const POLL = 20_000;           // fallback when realtime is unavailable
const HEARTBEAT = 5 * 60_000;
const TICK = 60_000;           // re-evaluate the state locally (check-out time, midnight)

export interface TvData {
  device: { id: string; name: string; channel: string };
  plan: { pro: boolean; max_tvs: number };
  restricted: boolean;
  property: Property;
  stays: { first_name: string; checkin: string; checkout: string }[];
}

const readCache = (): TvData | null => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch { return null; } };
const writeCache = (d: TvData) => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(d)); } catch { /* full */ } };
export const clearScreenCache = () => { try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ } };

/**
 * Keeps the TV fresh: realtime "refresh" broadcasts (debounced 1 s), a 20 s poll, a local
 * re-evaluation every minute, and an offline cache. Calls onUnpaired when the secret stops working.
 */
export function useScreenData(key: string, secret: string, onUnpaired: () => void) {
  const [data, setData] = useState<TvData | null>(readCache);
  const [offline, setOffline] = useState(false);
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(Date.now());
  const debounce = useRef<number>();
  const unpaired = useRef(onUnpaired);
  unpaired.current = onUnpaired;

  const fetchScreen = useCallback(async () => {
    const { data: r, error } = await tvClient.rpc("tv_screen", { p_device_key: key, p_secret: secret });
    if (error) { setOffline(true); return; }
    const err = (r as { error?: string }).error;
    if (err === "paused") { setPaused(true); setOffline(false); return; }   // host account paused: keep the pairing
    if (err) { unpaired.current(); return; }
    setPaused(false);
    setData(r as TvData);
    writeCache(r as TvData);
    setOffline(false);
    setNow(Date.now());
  }, [key, secret]);

  const heartbeat = useCallback(async (opened = false) => {
    const android = (window as unknown as { KaribuAndroid?: { version?: () => string } }).KaribuAndroid;
    const { data: r } = await tvClient.rpc("tv_heartbeat", {
      p_device_key: key, p_secret: secret, p_app_version: android?.version?.() || APP_VERSION,
      p_w: Math.round(window.screen.width * devicePixelRatio), p_h: Math.round(window.screen.height * devicePixelRatio), p_opened: opened,
    });
    if ((r as { error?: string } | null)?.error === "unpaired") unpaired.current();
  }, [key, secret]);

  useEffect(() => {
    fetchScreen();
    heartbeat(true);
    const poll = window.setInterval(fetchScreen, POLL);
    const hb = window.setInterval(() => heartbeat(false), HEARTBEAT);
    const tick = window.setInterval(() => setNow(Date.now()), TICK);
    const online = () => { fetchScreen(); heartbeat(false); };
    const goOffline = () => setOffline(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", goOffline);
    return () => {
      window.clearInterval(poll); window.clearInterval(hb); window.clearInterval(tick);
      window.clearTimeout(debounce.current);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", goOffline);
    };
  }, [fetchScreen, heartbeat]);

  // Realtime broadcast from the database triggers: tv-<channel>.
  const channel = data?.device.channel;
  useEffect(() => {
    if (!channel) return;
    const ch = tvClient.channel(`tv-${channel}`)
      .on("broadcast", { event: "refresh" }, () => {
        window.clearTimeout(debounce.current);
        debounce.current = window.setTimeout(fetchScreen, 1000);
      })
      .subscribe();
    return () => { tvClient.removeChannel(ch); };
  }, [channel, fetchScreen]);

  const payload: ScreenPayload | null = useMemo(() => data && buildPayload({
    property: data.property, stays: data.stays, plan: { pro: !!data.plan.pro }, nowMs: now, mediaUrl, restricted: data.restricted,
  }), [data, now]);

  return { payload, device: data?.device, offline, paused, refresh: fetchScreen };
}
