import QRCode from "qrcode";

export async function qrSvg(text: string, opts: { dark?: string; light?: string; margin?: number } = {}) {
  return QRCode.toString(text, {
    type: "svg", errorCorrectionLevel: "M", margin: opts.margin ?? 1,
    color: { dark: opts.dark || "#1b1b1b", light: opts.light || "#ffffff" },
  });
}

const esc = (s: string) => s.replace(/([\;,:"])/g, "\\$1");
export function wifiString(security: string, ssid: string, password: string) {
  const t = security === "nopass" ? "nopass" : security || "WPA";
  return `WIFI:T:${t};S:${esc(ssid)};P:${t === "nopass" ? "" : esc(password)};;`;
}
