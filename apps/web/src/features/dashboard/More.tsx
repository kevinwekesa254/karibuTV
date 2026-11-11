import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { BRAND, waLink } from "@/lib/brand";
import { Icon, WhatsAppIcon } from "@/components/Icons";
import { Card, PageHeader, Tag } from "@/components/ui";

export default function More() {
  const { user, plan, signOut } = useAuth();
  const nav = useNavigate();
  const items = [
    { to: "/app/guide", icon: "pin", label: "Guide & Extras" },
    { to: "/app/insights", icon: "chart", label: "Insights" },
    { to: "/app/support", icon: "help", label: "Support" },
    { to: "/app/properties", icon: "building", label: "Properties" },
    { to: "/app/wifi", icon: "wifi", label: "Wi-Fi & QR Code" },
    { to: "/app/rules", icon: "clipboard", label: "House Rules" },
    { to: "/app/integrations", icon: "link", label: "Integrations" },
    { to: "/app/billing", icon: "card", label: "Billing", extra: plan.pro ? <Tag tone="ink">{plan.trial ? "TRIAL" : "PRO"}</Tag> : <Tag>FREE</Tag> },
    { to: "/app/settings", icon: "settings", label: "Settings" },
  ];
  return (
    <div>
      <PageHeader title="More" subtitle={user?.email} />
      <Card className="overflow-hidden">
        <ul className="divide-y divide-line">
          {items.map((i) => (
            <li key={i.to}><Link to={i.to} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-wash"><Icon name={i.icon} /><span className="flex-1 font-semibold">{i.label}</span>{i.extra}<Icon name="chevron-right" size={18} className="text-ink-muted" /></Link></li>
          ))}
          <li><a href={waLink(BRAND.supportWhatsApp, "Hi! I need help with Karibu TV.")} target="_blank" rel="noreferrer" className="flex items-center gap-4 px-5 py-4 hover:bg-surface-wash"><WhatsAppIcon /><span className="flex-1 font-semibold">Help on WhatsApp</span><Icon name="chevron-right" size={18} className="text-ink-muted" /></a></li>
          <li><button onClick={async () => { await signOut(); nav("/signin"); }} className="flex w-full items-center gap-4 px-5 py-4 text-left text-danger hover:bg-surface-wash"><Icon name="logout" /><span className="font-semibold">Sign out</span></button></li>
        </ul>
      </Card>
    </div>
  );
}
