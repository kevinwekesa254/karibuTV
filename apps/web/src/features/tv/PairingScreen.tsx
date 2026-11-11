import { useEffect, useRef, useState } from "react";
import { tvClient } from "@/lib/supabase";
import { setDeviceSecret } from "./device";
import { qrSvg } from "@/lib/qr";
import { appUrl, BRAND } from "@/lib/brand";
import { Icon } from "@/components/Icons";
import { Stage } from "./WelcomeScreen";
import { THEMES } from "./themes";

interface Session { code: string; expires: string; poll_secret: string }
const th = THEMES.karibu;
const TEN_MIN = 10 * 60 * 1000;

function formatCode(c: string) { return `${c.slice(0, 3)} ${c.slice(3)}`; }

/** Unpaired TV: shows a rotating 6-character code and polls until the host links it (BUILD_SPEC 8.2). */
export function PairingScreen({ deviceKey, onPaired }: { deviceKey: string; onPaired: () => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const [qr, setQr] = useState("");
  const [now, setNow] = useState(Date.now());
  const stopped = useRef(false);

  // Start (and restart on expiry) a pairing session.
  useEffect(() => {
    stopped.current = false;
    let retry: number | undefined;
    const start = async () => {
      try {
        const { data: s, error: err } = await tvClient.rpc("pair_start", { p_device_key: deviceKey });
        if (err) throw err;
        if (stopped.current) return;
        setSession(s as Session);
        setError("");
      } catch (e: unknown) {
        const limited = /rate_limited/.test((e as { message?: string })?.message || "");
        setError(limited ? "Waiting a moment before getting a new code…" : "Can't reach Karibu. Check the TV's internet connection.");
        retry = window.setTimeout(start, limited ? 20000 : 8000);
      }
    };
    if (!session) start();
    return () => { stopped.current = true; window.clearTimeout(retry); };
  }, [deviceKey, session]);

  // Poll every 3 s.
  useEffect(() => {
    if (!session) return;
    const id = window.setInterval(async () => {
      try {
        const { data: r } = await tvClient.rpc("pair_status", { p_device_key: deviceKey, p_poll_secret: session.poll_secret });
        const st = r as { status: string; device_secret?: string } | null;
        if (st?.status === "linked" && st.device_secret) {
          window.clearInterval(id);
          setDeviceSecret(st.device_secret);
          onPaired();
        } else if (st && ["expired", "collected", "unknown"].includes(st.status)) {
          window.clearInterval(id);
          setSession(null);
        }
      } catch { /* offline: keep polling */ }
      setNow(Date.now());
    }, 3000);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { window.clearInterval(id); window.clearInterval(tick); };
  }, [session, deviceKey, onPaired]);

  useEffect(() => {
    if (!session) return;
    qrSvg(`${appUrl()}/app/tvs/pair?code=${session.code}`, { margin: 0 }).then(setQr);
  }, [session]);

  useEffect(() => {
    if (session && Date.parse(session.expires) < now) setSession(null);
  }, [now, session]);

  const left = session ? Math.max(0, Date.parse(session.expires) - now) : 0;
  const frac = left / TEN_MIN;
  const mins = Math.floor(left / 60000), secs = Math.floor((left % 60000) / 1000);
  const R = 54, C = 2 * Math.PI * R;
  const host = appUrl().replace(/^https?:\/\//, "");

  return (
    <Stage bg={th.bg}>
      <div style={{ width: 1920, height: 1080, background: th.bg, color: th.text, padding: 96, fontFamily: "Inter, sans-serif" }} className="relative flex flex-col">
        <div className="flex items-center gap-4 font-display" style={{ fontSize: 40, fontWeight: 600 }}>
          <span className="flex items-center justify-center" style={{ width: 64, height: 64, borderRadius: 18, background: th.accent, color: th.onAccent }}><Icon name="tv" size={36} strokeWidth={2.2} /></span>
          {BRAND.name}
        </div>

        <div className="flex flex-1 items-center gap-24">
          <div className="flex-1">
            <p style={{ fontSize: 32, color: th.accent, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Pair this TV</p>
            <div className="mt-6 flex items-center gap-10">
              <div className="font-display" style={{ fontSize: 168, fontWeight: 600, letterSpacing: "0.06em", lineHeight: 1 }} aria-live="polite">
                {session ? formatCode(session.code) : "··· ···"}
              </div>
              {session && (
                <div className="relative" style={{ width: 128, height: 128 }} aria-label={`Code expires in ${mins} minutes`}>
                  <svg width="128" height="128" viewBox="0 0 128 128" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="64" cy="64" r={R} fill="none" stroke={th.panelLine} strokeWidth="10" />
                    <circle cx="64" cy="64" r={R} fill="none" stroke={th.accent} strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: 30, fontWeight: 600 }}>{mins}:{String(secs).padStart(2, "0")}</div>
                </div>
              )}
            </div>
            {error && <p style={{ fontSize: 30, color: "#ff9b8f", marginTop: 24 }}>{error}</p>}
            <ol className="mt-14 space-y-6" style={{ fontSize: 34, lineHeight: 1.3 }}>
              {[
                <>On your phone, open <b style={{ color: th.accent }}>{host}</b></>,
                <>Go to <b>TVs</b> → <b>Pair a TV</b></>,
                <>Type the code above, or scan the QR code</>,
              ].map((s, i) => (
                <li key={i} className="flex items-center gap-5">
                  <span className="flex shrink-0 items-center justify-center font-display" style={{ width: 56, height: 56, borderRadius: 999, background: th.chip, color: th.accent, fontWeight: 700 }}>{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex flex-col items-center gap-6">
            <div style={{ width: 400, height: 400, background: "#fff", borderRadius: 32, padding: 28 }} className="[&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
            <p style={{ fontSize: 28, color: th.muted }}>Scan to pair with your phone</p>
          </div>
        </div>
        <p style={{ fontSize: 24, color: th.muted }}>A new code appears every 10 minutes. This TV ID ends in …{deviceKey.slice(-4)}</p>
      </div>
    </Stage>
  );
}
