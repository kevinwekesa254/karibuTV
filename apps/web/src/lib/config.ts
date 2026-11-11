// Plans and limits. Enforced in the database; mirrored here for the UI. Prices live in lib/pricing.ts.
export const CONFIG = {
  plans: {
    free: { tvs: 1, properties: 1 },
    pro: { properties: 50 },
  },
  trialDays: 30,
  /** Paused features: switch on when ready (code and database support stay in place). */
  features: { aiAssistant: false, socialLogin: false },
  founding_offer: { label: "Founding host · first 100", active: true },
  payments_enabled: false,
  /** Where hosts download the TV app (typed into the TV's Downloader app). */
  // The TV app download, served from our own domain by api/tv-apk.ts (no GitHub page in between).
  apk_url: (import.meta.env.VITE_APK_URL as string | undefined) || "https://tv.mrserengeti.com/tv.apk",
  app_short_url: (import.meta.env.VITE_APP_SHORT_URL as string | undefined) || "tv.mrserengeti.com/tv.apk",
  app_version: "1.0.0",
};
export type AppConfig = typeof CONFIG;
export const useConfig = () => CONFIG;
