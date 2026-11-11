import { useState } from "react";
import type { Property } from "@/lib/types";
import { Icon } from "@/components/Icons";
import { ButtonLink, Card, EmptyState, Field, Input, PageHeader, Select, Toggle } from "@/components/ui";
import { useData } from "./data";
import { SaveBar, Section, usePropertyDraft, useSaveProperty } from "./shared/editing";
import { PropertySwitcher, WifiQrPreview } from "./shared/widgets";

function WifiEditor({ property }: { property: Property }) {
  const { draft, set, dirty, reset } = usePropertyDraft(property, ["wifi_ssid", "wifi_password", "wifi_security", "show_wifi_password"]);
  const { save, saving } = useSaveProperty(property);
  const [show, setShow] = useState(false);
  const sec = draft.wifi_security;
  const pwErr = sec === "WPA" && draft.wifi_password && draft.wifi_password.length < 8 ? "WPA passwords are at least 8 characters. Check it matches your router." : "";
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <Section icon="wifi" title="Wi-Fi" description="Guests join by scanning the QR code on the TV. Update it whenever you change the router password.">
        <div className="space-y-4">
          <Field label="Network name (SSID)" hint="Exactly as it appears on a phone, including capitals.">{(id, d) => <Input id={id} value={draft.wifi_ssid} onChange={(e) => set("wifi_ssid", e.target.value)} maxLength={64} autoComplete="off" spellCheck={false} aria-describedby={d} placeholder="CasaMara_5G" />}</Field>
          <Field label="Security">{(id) => (
            <Select id={id} value={sec} onChange={(e) => set("wifi_security", e.target.value as Property["wifi_security"])}>
              <option value="WPA">WPA / WPA2 / WPA3 (most routers)</option><option value="WEP">WEP (old routers)</option><option value="nopass">Open network, no password</option>
            </Select>
          )}</Field>
          {sec !== "nopass" && (
            <>
              <Field label="Password" error={pwErr}>{(id, d) => (
                <div className="relative">
                  <Input id={id} type={show ? "text" : "password"} value={draft.wifi_password} onChange={(e) => set("wifi_password", e.target.value)} maxLength={64} autoComplete="off" spellCheck={false} aria-describedby={d} className="pr-12 font-mono" />
                  <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-ink-muted hover:bg-mint-soft" aria-label={show ? "Hide password" : "Show password"}><Icon name={show ? "eye-off" : "eye"} size={18} /></button>
                </div>
              )}</Field>
              <Toggle checked={draft.show_wifi_password} onChange={(v) => set("show_wifi_password", v)} label="Show the password on the TV" description="Turn off to show only the QR code. Guests whose phones can't scan will need to ask you." />
            </>
          )}
        </div>
      </Section>
      <div className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-2 text-sm font-semibold text-ink">On the TV</p>
        <WifiQrPreview ssid={draft.wifi_ssid} password={draft.wifi_password} security={sec} showPassword={draft.show_wifi_password} />
        <p className="mt-2 text-xs text-ink-muted">Test it: scan this with your phone camera before guests arrive.</p>
      </div>
      <div className="lg:col-span-2"><SaveBar dirty={dirty} saving={saving} onSave={() => save(draft)} onDiscard={reset} /></div>
    </div>
  );
}

export default function Wifi() {
  const { selected } = useData();
  return (
    <div>
      <PageHeader title={<span className="flex items-center gap-3"><Icon name="wifi" size={28} />Wi-Fi & QR Code</span>} subtitle="The network guests join from the TV." actions={<PropertySwitcher />} />
      {selected ? <WifiEditor key={selected.id} property={selected} /> : <Card><EmptyState icon="building" title="Add a property first" action={<ButtonLink to="/app/properties">Add property</ButtonLink>} /></Card>}
    </div>
  );
}
