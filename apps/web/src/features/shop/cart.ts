// Cart kept in localStorage (no account needed). Prices are never stored here: the server prices every order.
import { useSyncExternalStore } from "react";

export interface CartLine { product_id: string; qty: number }
const KEY = "karibu_cart_v1";
const EVENT = "karibu-cart";

function read(): CartLine[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((l) => l && typeof l.product_id === "string" && l.qty > 0).slice(0, 10) : [];
  } catch { return []; }
}
let cache = read();
function write(lines: CartLine[]) {
  cache = lines;
  try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* private mode */ }
  window.dispatchEvent(new Event(EVENT));
}

const subscribe = (cb: () => void) => {
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) { cache = read(); cb(); } };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", onStorage); };
};

export function useCart() {
  const lines = useSyncExternalStore(subscribe, () => cache, () => cache);
  return {
    lines,
    count: lines.reduce((n, l) => n + l.qty, 0),
    add: (product_id: string, qty = 1) => {
      const next = [...cache];
      const i = next.findIndex((l) => l.product_id === product_id);
      if (i >= 0) next[i] = { ...next[i], qty: Math.min(10, next[i].qty + qty) }; else next.push({ product_id, qty: Math.min(10, qty) });
      write(next);
    },
    setQty: (product_id: string, qty: number) => write(qty <= 0 ? cache.filter((l) => l.product_id !== product_id) : cache.map((l) => (l.product_id === product_id ? { ...l, qty: Math.min(10, qty) } : l))),
    remove: (product_id: string) => write(cache.filter((l) => l.product_id !== product_id)),
    clear: () => write([]),
  };
}
