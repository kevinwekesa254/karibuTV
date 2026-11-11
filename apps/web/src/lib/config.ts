// Plans and limits. Enforced in the database; mirrored here for the UI. Prices live in lib/pricing.ts.
export const CONFIG = {
  plans: {
    free: { tvs: 1, properties: 1 },
    pro: { properties: 50 },
  },
  trialDays: 30,
  founding_offer: { label: "Founding host · first 100", active: true },
  payments_enabled: false,
  /** Where hosts download the TV app (typed into the TV's Downloader app). */
  // /tv.apk redirects to the latest GitHub release (see vercel.json and .github/workflows/tv-apk.yml).
  apk_url: (import.meta.env.VITE_APK_URL as string | undefined) || (typeof window !== "undefined" ? `${window.location.origin}/tv.apk` : ""),
  app_short_url: (import.meta.env.VITE_APP_SHORT_URL as string | undefined) || (typeof window !== "undefined" ? `${window.location.host}/tv.apk` : ""),
  app_version: "1.0.0",
};
export type AppConfig = typeof CONFIG;
export const useConfig = () => CONFIG;
