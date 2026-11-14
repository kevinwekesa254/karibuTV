// A soft two-note chime for new notifications (no audio file). Hosts can turn it off in the bell menu.
const KEY = "kb-sound";
let ctx: AudioContext | null = null;

export function soundOn() { try { return localStorage.getItem(KEY) !== "off"; } catch { return true; } }
export function setSoundOn(v: boolean) { try { localStorage.setItem(KEY, v ? "on" : "off"); } catch { /* private mode */ } }

export function chime() {
  if (!soundOn()) return;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = ctx || new AC();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const t0 = ctx.currentTime + 0.02;
    [[659.25, 0], [987.77, 0.14]].forEach(([freq, delay]) => {
      const o = ctx!.createOscillator(), g = ctx!.createGain();
      o.type = "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(0, t0 + delay);
      g.gain.linearRampToValueAtTime(0.06, t0 + delay + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + 0.9);
      o.connect(g).connect(ctx!.destination);
      o.start(t0 + delay); o.stop(t0 + delay + 1);
    });
  } catch { /* audio blocked until the host taps the page; the visual alert still shows */ }
}
