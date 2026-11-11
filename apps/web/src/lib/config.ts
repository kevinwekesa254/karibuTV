// Plans, limits and prices (BUILD_SPEC 8.7). Enforced in the database; mirrored here for the UI.
export const CONFIG = {
  plans: {
    free: { tvs: 1, properties: 1 },
    pro: { properties: 50 },
  },
  trialDays: 30,
  prices: { KES: { month: 500, year: 5000 }, USD: { month: 4, year: 39 } },
  founding_offer: { label: "Founding host · first 100", active: true },
  payments_enabled: false,
  /** Where hosts download the TV app (typed into the TV's Downloader app). */
  apk_url: (import.meta.env.VITE_APK_URL as string | undefined) || "",
  app_short_url: (import.meta.env.VITE_APP_SHORT_URL as string | undefined) || "",
  app_version: "1.0.0",
};
export type AppConfig = typeof CONFIG;
export const useConfig = () => CONFIG;
