export type PlanName = "free" | "pro";
export type ScreenState = "arriving" | "checkout" | "between";
export type Layout = "classic" | "mirror" | "fullphoto" | "spotlight" | "minimal";
export type ThemeName = "karibu" | "maroon" | "midnight" | "teal" | "forest" | "charcoal" | "plum" | "espresso" | "ocean" | "coast" | "safari" | "city" | "custom";
export type Provider = "airbnb" | "booking" | "vrbo" | "google" | "ical" | "pms";

export interface Profile {
  id: string; name: string; whatsapp: string; country: "KE" | "TZ" | "UG" | "RW" | "other";
  plan: PlanName; plan_until: string | null; pro_tvs: number; trial: boolean;
  onboarding: { step?: number; done?: boolean; property?: string };
  created_at: string;
}

export interface HouseRule { icon: string; text: string }
/** A host recommendation: a beach, a restaurant, a trusted taxi driver. */
export interface Pick { title: string; note: string; url: string }
/** Something guests can ask the host for on WhatsApp (airport transfer, late check-out…). */
export interface Extra { title: string; price: string }

export interface Property {
  id: string; owner_id: string; name: string; tagline: string; area: string; timezone: string;
  checkin_time: string; checkout_time: string; quiet_start: string; quiet_end: string;
  amenities: string[]; house_rules: HouseRule[]; checkout_steps: string[]; max_guests: number;
  host_name: string; host_contact: string; welcome_title: string; welcome_note: string;
  generic_title: string; generic_note: string; thankyou_line: string; contact_title: string; contact_line: string;
  wifi_ssid: string; wifi_password: string; wifi_security: "WPA" | "WEP" | "nopass"; show_wifi_password: boolean;
  layout: Layout; theme: ThemeName; color_bg: string; color_accent: string;
  photo_welcome: string; photo_checkout: string; photo_generic: string; logo: string; logo_position: "header" | "wifi";
  weather_enabled: boolean; weather_place: string; weather_lat: number | null; weather_lon: number | null;
  weather_json: WeatherData | null; weather_at: string | null;
  review_url: string; picks: Pick[]; extras: Extra[]; motion: boolean;
  created_at: string; updated_at: string;
}

export interface WeatherData { today: { temp_c: number; symbol: string }; days: { date: string; min_c: number; max_c: number; symbol: string }[] }

export interface Stay {
  id: string; property_id: string; first_name: string; checkin: string; checkout: string;
  source: "manual" | "ical" | "email"; calendar_id: string | null; external_id: string; note: string; cancelled: boolean;
  created_at: string;
  calendars?: { label: string; provider: Provider } | null;
}

export interface Calendar {
  id: string; property_id: string; provider: Provider; label: string; url: string; last_synced: string | null;
  last_status: "ok" | "error" | "pending"; last_error: string; event_count: number; created_at: string;
}

export interface Device {
  id: string; device_key: string; owner_id: string | null; property_id: string | null; name: string;
  last_seen: string | null; opened_at: string | null; app_version: string; screen_w: number | null; screen_h: number | null; created_at: string;
}

export interface Payment {
  id: string; provider: string; amount: number; currency: string; period: string; tvs: number; status: string; receipt: string; created_at: string;
}

/** What the TV renders. Built on the TV (and in previews) from property + stays by lib/screen.ts. */
export interface ScreenPayload {
  state: ScreenState;
  now: string;
  next_change_at: string;
  plan: { pro: boolean; branded: boolean; logo: boolean; weather: boolean };
  restricted?: boolean;
  property: {
    name: string; tagline: string; area: string; timezone: string;
    checkin_time: string; checkout_time: string; quiet_start: string; quiet_end: string; max_guests: number | null;
    amenities: string[]; house_rules: HouseRule[]; checkout_steps: string[];
    host_name: string; host_contact: string; welcome_title: string; welcome_note: string;
    generic_title: string; generic_note: string; thankyou_line: string; contact_title: string; contact_line: string;
    layout: Layout; theme: string; color_bg?: string; color_accent?: string;
    photo_url: string | null; logo_url: string | null; logo_position: "header" | "wifi";
    id?: string; review_url: string; picks: Pick[]; extras: Extra[]; motion: boolean;
  };
  wifi: { ssid: string; password: string | null; security: "WPA" | "WEP" | "nopass"; qr_string: string };
  stay: { first_name: string; checkin: string; checkout: string; nights: number } | null;
  weather: { place: string; today: { temp_c: number; symbol: string }; days: { date: string; min_c: number; max_c: number; symbol: string }[] } | null;
}
