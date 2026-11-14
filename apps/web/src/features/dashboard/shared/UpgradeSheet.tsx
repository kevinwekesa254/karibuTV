import { formatMoney, quote } from "@/lib/pricing";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";

import { BRAND, waLink } from "@/lib/brand";
import { Icon, WhatsAppIcon } from "@/components/Icons";
import { Modal } from "@/components/ui";
import { useData } from "../data";

export const PRO_FEATURES = [
  { icon: "calendar", text: "Follows your Airbnb, Booking.com and Vrbo calendars" },
  { icon: "tv", text: "More than one TV, priced per TV" },
  { icon: "building", text: "Up to 50 properties" },
  { icon: "image", text: "Your own logo on the screen, no Karibu TV badge" },
  { icon: "clearsky", text: "Weather for today and the next 3 days" },
];

export function priceLine(country: string | undefined) {
  const c = country === "KE" || !country ? "KES" : "USD";
  return `${formatMoney(quote(1, 1, c).unit, c)} per TV / month for 3 months, then ${formatMoney(quote(1, 4, c).unit, c)}`;
}

export function UpgradeSheet() {
  const { upgradeReason, closeUpgrade } = useData();
  const { user, profile } = useAuth();
  const wa = BRAND.supportWhatsApp;
  return (
    <Modal open={!!upgradeReason} onClose={closeUpgrade} title="Upgrade to Pro">
      <p className="text-ink">{upgradeReason}</p>
      <ul className="mt-4 space-y-3">
        {PRO_FEATURES.map((f) => (
          <li key={f.text} className="flex items-start gap-3 text-sm">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mint-soft text-forest"><Icon name={f.icon} size={18} /></span>
            <span className="pt-1.5">{f.text}</span>
          </li>
        ))}
      </ul>
      <p className="mt-5 font-display text-xl font-semibold text-forest">{priceLine(profile?.country)}</p>
      <p className="text-sm text-maroon">5 or more TVs: 15% off the whole bill.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link to="/app/billing" onClick={closeUpgrade} className="kb-btn kb-btn--primary kb-btn--md"><Icon name="card" size={18} />See plans and upgrade</Link>
        <a className="kb-btn kb-btn--secondary kb-btn--md" href={waLink(wa, `Hi! I'd like to upgrade ${user?.email || "my account"} to Karibu TV Pro.`)} target="_blank" rel="noreferrer">
          <WhatsAppIcon size={18} /> Ask on WhatsApp
        </a>
      </div>
    </Modal>
  );
}
