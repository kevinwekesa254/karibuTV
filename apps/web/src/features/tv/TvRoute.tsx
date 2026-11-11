import { useCallback, useEffect, useRef, useState } from "react";
import { BRAND } from "@/lib/brand";
import { supabaseConfigured } from "@/lib/supabase";
import { PairingScreen } from "./PairingScreen";
import { WelcomeScreen, Stage } from "./WelcomeScreen";
import { APP_VERSION, clearScreenCache, useScreenData } from "./useScreenData";
import { deviceKey as getDeviceKey, deviceSecret, setDeviceSecret } from "./device";
import { THEMES } from "./themes";

const th = THEMES.karibu;

export default function TvRoute() {
  const [key] = useState(getDeviceKey);
  const [secret, setSecret] = useState<string | null>(deviceSecret);

  useEffect(() => {
    document.documentElement.dataset.theme = "dark";
    document.title = BRAND.name;
    document.body.style.cursor = "none";
    document.body.style.background = th.bg;
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => { delete document.documentElement.dataset.theme; document.body.style.cursor = ""; document.body.style.background = ""; };
  }, []);

  const unpair = useCallback(() => {
    setDeviceSecret(null);
    clearScreenCache();
    setSecret(null);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: th.bg }}>
      {!supabaseConfigured ? <Message text="Karibu TV isn't connected to its server yet." />
        : secret ? <PairedTv deviceKey={key} secret={secret} onUnpaired={unpair} />
        : <PairingScreen deviceKey={key} onPaired={() => setSecret(deviceSecret())} />}
    </div>
  );
}

function Message({ text }: { text: string }) {
  return (
    <Stage bg={th.bg}>
      <div style={{ width: 1920, height: 1080, color: th.text, fontSize: 40 }} className="flex items-center justify-center font-display">{text}</div>
    </Stage>
  );
}

function useBurnInShift() {
  const [shift, setShift] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const id = window.setInterval(() => setShift({ x: Math.round(Math.random() * 16 - 8), y: Math.round(Math.random() * 16 - 8) }), 60 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);
  return shift;
}

const MENU = ["Refresh", "Show pairing code", "About", "Close"];

function PairedTv({ deviceKey, secret, onUnpaired }: { deviceKey: string; secret: string; onUnpaired: () => void }) {
  const { payload, device, offline, refresh } = useScreenData(deviceKey, secret, onUnpaired);
  const shift = useBurnInShift();
  const [menu, setMenu] = useState(false);
  const [about, setAbout] = useState(false);
  const [focus, setFocus] = useState(0);
  const hold = useRef<number>();

  const choose = useCallback((i: number) => {
    if (i === 0) { refresh(); setMenu(false); }
    else if (i === 1) onUnpaired();
    else if (i === 2) setAbout((a) => !a);
    else { setMenu(false); setAbout(false); }
  }, [refresh, onUnpaired]);

  // Remote: OK/Back do nothing for guests; long-press OK (3 s) opens the menu.
  useEffect(() => {
    const isOk = (e: KeyboardEvent) => e.key === "Enter" || e.key === " " || e.keyCode === 23;
    const isBack = (e: KeyboardEvent) => e.key === "Escape" || e.key === "Backspace" || e.key === "GoBack";
    const down = (e: KeyboardEvent) => {
      if (menu) {
        if (e.key === "ArrowDown") { setFocus((f) => (f + 1) % MENU.length); e.preventDefault(); }
        else if (e.key === "ArrowUp") { setFocus((f) => (f + MENU.length - 1) % MENU.length); e.preventDefault(); }
        else if (isBack(e)) { setMenu(false); setAbout(false); e.preventDefault(); }
        else if (isOk(e) && !e.repeat) { e.preventDefault(); choose(focus); }
        return;
      }
      if (isOk(e)) {
        e.preventDefault();
        if (!e.repeat && !hold.current) hold.current = window.setTimeout(() => { setMenu(true); setFocus(0); hold.current = undefined; }, 3000);
      } else if (isBack(e)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => { if (isOk(e)) { window.clearTimeout(hold.current); hold.current = undefined; } };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [menu, focus, choose]);

  if (!payload) return <Message text={offline ? "Waiting for internet…" : "Welcome…"} />;

  const overlay = (
    <>
      {offline && <div aria-hidden style={{ position: "absolute", left: 28, bottom: 28, width: 14, height: 14, borderRadius: 999, background: "#fdb022", opacity: 0.8 }} />}
      {menu && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,.6)" }}>
          <div style={{ background: th.panel, border: `2px solid ${th.panelLine}`, borderRadius: 32, padding: 32, width: 640, color: th.text }}>
            <div className="font-display" style={{ fontSize: 36, fontWeight: 600, marginBottom: 16 }}>{BRAND.name}</div>
            {MENU.map((label, i) => (
              <button key={label} onClick={() => choose(i)} onMouseEnter={() => setFocus(i)}
                style={{ display: "block", width: "100%", textAlign: "left", fontSize: 32, padding: "16px 24px", borderRadius: 16, background: focus === i ? th.accent : "transparent", color: focus === i ? th.onAccent : th.text, fontWeight: 600 }}>
                {label}
              </button>
            ))}
            {about && (
              <div style={{ fontSize: 24, color: th.muted, marginTop: 16, lineHeight: 1.5 }}>
                Version {APP_VERSION} · {device?.name || "TV"}<br />
                TV ID …{deviceKey.slice(-6)}<br />
                {offline ? "Offline — showing the saved screen" : "Online"}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );

  return <WelcomeScreen payload={payload} shift={shift} overlay={overlay} />;
}
