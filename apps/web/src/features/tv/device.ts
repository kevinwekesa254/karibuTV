// TV identity kept in localStorage: device_key (from the Android shell's #device_key=… or generated)
// and the device secret handed over once at pairing.
const KEY = "karibu_device_key";
const SECRET = "karibu_device_secret";
const ALPHA = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* storage blocked */ } };

export function deviceKey(): string {
  const fromHash = new URLSearchParams(window.location.hash.slice(1)).get("device_key");
  if (fromHash && /^[A-Za-z0-9_-]{16,64}$/.test(fromHash)) { set(KEY, fromHash); return fromHash; }
  const stored = get(KEY);
  if (stored) return stored;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const key = Array.from(bytes, (b) => ALPHA[b % ALPHA.length]).join("");
  set(KEY, key);
  return key;
}
export const deviceSecret = () => get(SECRET);
export const setDeviceSecret = (s: string | null) => set(SECRET, s);
