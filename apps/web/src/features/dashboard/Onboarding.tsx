import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, errorMessage, errorCode } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import type { HouseRule, Property } from "@/lib/types";
import { Logo } from "@/components/Logo";
import { AMENITIES, Icon } from "@/components/Icons";
import { Button, ErrorBanner, Field, Input, PageLoader, Select, Toggle } from "@/components/ui";
import { DataProvider, useData } from "./data";
import { UpgradeSheet } from "./shared/UpgradeSheet";
import { PairTvForm } from "./shared/PairTvForm";
import { WifiQrPreview } from "./shared/widgets";
import { InstallSteps } from "./Tvs";
import { newPropertyDefaults, phoneOk } from "./Properties";
import { PhoneInput } from "@/components/PhoneInput";
import { TIME_RE } from "./shared/editing";

const STEPS = ["Property", "Wi-Fi", "House rules", "Pair your TV"];
const RULES: HouseRule[] = [
  { icon: "no-smoking", text: "No smoking" },
  { icon: "no-parties", text: "No parties" },
  { icon: "no-pets", text: "No pets" },
  { icon: "shoes", text: "Shoes off indoors" },
];
const STEPS_PRESET = ["Leave the keys on the kitchen table", "Switch off the AC and lights", "Put used towels in the bathroom", "Close the windows and lock the door"];

function StepShell({ step, title, subtitle, children, onBack, onSkip, onNext, nextLabel = "Continue", saving }: {
  step: number; title: string; subtitle: string; children: ReactNode; onBack?: () => void; onSkip?: () => void; onNext: () => void; nextLabel?: string; saving?: boolean;
}) {
  return (
    <div className="min-h-screen bg-surface-wash">
      <div className="kb-band rounded-b-band px-4 pb-20 pt-6">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Logo to="/app" />
          <span className="text-sm font-semibold text-on-mint">Step {step + 1} of {STEPS.length}</span>
        </div>
        <ol className="mx-auto mt-6 flex max-w-2xl gap-2" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} className="flex-1">
              <div className={`h-1.5 rounded-full ${i <= step ? "bg-forest" : "bg-forest/20"}`} />
              <span className={`mt-1.5 hidden text-xs font-semibold sm:block ${i === step ? "text-forest" : "text-forest/60"}`}>{s}</span>
            </li>
          ))}
        </ol>
      </div>
      <main className="mx-auto -mt-12 max-w-2xl px-4 pb-16">
        <div className="kb-card p-5 shadow-panel sm:p-8">
          <h1 className="font-display text-display-sm text-forest">{title}</h1>
          <p className="mt-1 text-ink-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <div>{onBack && <Button variant="ghost" icon="chevron-left" onClick={onBack}>Back</Button>}</div>
            <div className="flex gap-2">
              {onSkip && <Button variant="ghost" onClick={onSkip}>Skip for now</Button>}
              <Button onClick={onNext} loading={saving}>{nextLabel}</Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Wizard() {
  const { user, profile, refreshProfile } = useAuth();
  const { properties, reloadProperties, reloadDevices, upsertProperty, openUpgrade, selectProperty, loading } = useData();
  const toast = useToast();
  const nav = useNavigate();
  const [step, setStep] = useState<number>(profile?.onboarding?.step ?? 0);
  const [property, setProperty] = useState<Property | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);

  const [basics, setBasics] = useState({ name: "", area: "", checkin_time: "14:00", checkout_time: "11:00", host_name: (profile?.name || "").split(" ")[0], host_contact: profile?.whatsapp || "", amenities: ["wifi", "tv", "hot-shower"] });
  const [wifi, setWifi] = useState({ wifi_ssid: "", wifi_password: "", wifi_security: "WPA" as Property["wifi_security"], show_wifi_password: true });
  const [rules, setRules] = useState<HouseRule[]>(RULES.slice(0, 2));
  const [steps, setSteps] = useState<string[]>(STEPS_PRESET.slice(0, 3));
  const [maxGuests, setMaxGuests] = useState(4);

  useEffect(() => {
    if (loading) return;
    const p = properties.find((x) => x.id === profile?.onboarding?.property) || properties[0] || null;
    if (p) {
      setProperty(p);
      setBasics({ name: p.name, area: p.area, checkin_time: p.checkin_time, checkout_time: p.checkout_time, host_name: p.host_name, host_contact: p.host_contact, amenities: p.amenities || [] });
      setWifi({ wifi_ssid: p.wifi_ssid, wifi_password: p.wifi_password, wifi_security: p.wifi_security || "WPA", show_wifi_password: p.show_wifi_password });
      if (p.house_rules?.length) setRules(p.house_rules);
      if (p.checkout_steps?.length) setSteps(p.checkout_steps);
      if (p.max_guests) setMaxGuests(p.max_guests);
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const progress = (next: number, propId?: string) =>
    supabase.from("profiles").update({ onboarding: { step: next, property: propId || property?.id || "", done: next >= STEPS.length } }).eq("id", user!.id).then(() => refreshProfile());

  const go = (n: number) => { setError(""); setTouched(false); setStep(n); window.scrollTo(0, 0); };

  const finish = async (paired = false) => {
    await progress(STEPS.length);
    await reloadProperties();
    if (!paired) toast("You're all set. Karibu!");
    nav(property ? `/app/screens${paired ? "?live=1" : ""}` : "/app", { replace: true });
  };

  const saveStep = async (data: Partial<Property>, next: number) => {
    setSaving(true); setError("");
    try {
      let p = property;
      if (!p) {
        const base = newPropertyDefaults(basics.name.trim(), basics.area.trim(), basics.host_name, basics.host_contact);
        const { data: rec, error } = await supabase.from("properties")
          .insert({ ...base, house_rules: rules, checkout_steps: steps, max_guests: maxGuests, ...data }).select("*").single();
        if (error) throw error;
        p = rec as Property;
        selectProperty(p.id);
      } else {
        const { data: rec, error } = await supabase.from("properties").update(data).eq("id", p.id).select("*").single();
        if (error) throw error;
        p = rec as Property;
      }
      setProperty(p);
      upsertProperty(p);
      await progress(next, p.id);
      go(next);
    } catch (err) {
      if (errorCode(err) === "plan_limit") openUpgrade(errorMessage(err));
      else setError(errorMessage(err));
    } finally { setSaving(false); }
  };

  if (loading) return <PageLoader />;

  if (step === 0) {
    const errs = {
      name: !basics.name.trim() ? "Give your place a name, e.g. Casa Mara." : "",
      times: !TIME_RE.test(basics.checkin_time) || !TIME_RE.test(basics.checkout_time) ? "Set check-in and check-out times." : "",
      phone: !phoneOk(basics.host_contact) ? "Check the number after the country code." : "",
    };
    return (
      <StepShell step={0} title="Tell us about your place" subtitle="This shows at the top of the TV." saving={saving}
        onNext={() => { setTouched(true); if (!Object.values(errs).some(Boolean)) saveStep({ ...basics, name: basics.name.trim(), host_contact: basics.host_contact.replace(/[\s-]/g, "") }, 1); }}>
        <div className="space-y-4">
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Property name" error={touched ? errs.name : ""}>{(id) => <Input id={id} value={basics.name} onChange={(e) => setBasics({ ...basics, name: e.target.value })} maxLength={80} placeholder="Casa Mara" autoFocus />}</Field>
            <Field label="Area" optional>{(id) => <Input id={id} value={basics.area} onChange={(e) => setBasics({ ...basics, area: e.target.value })} maxLength={80} placeholder="Diani Beach" />}</Field>
            <Field label="Check-in time" error={touched ? errs.times : ""}>{(id) => <Input id={id} type="time" value={basics.checkin_time} onChange={(e) => setBasics({ ...basics, checkin_time: e.target.value })} />}</Field>
            <Field label="Check-out time">{(id) => <Input id={id} type="time" value={basics.checkout_time} onChange={(e) => setBasics({ ...basics, checkout_time: e.target.value })} />}</Field>
            <Field label="Your first name" optional hint='For "Need anything? WhatsApp Amina".'>{(id, d) => <Input id={id} value={basics.host_name} onChange={(e) => setBasics({ ...basics, host_name: e.target.value })} maxLength={60} aria-describedby={d} />}</Field>
            <Field label="WhatsApp for guests" optional error={touched ? errs.phone : ""}>{(id) => <PhoneInput id={id} value={basics.host_contact} country={profile?.country} onChange={(v) => setBasics({ ...basics, host_contact: v })} invalid={touched && !!errs.phone} />}</Field>
          </div>
          <div>
            <p className="kb-label">Amenities</p>
            <div className="flex flex-wrap gap-2">
              {AMENITIES.map((a) => {
                const on = basics.amenities.includes(a.key);
                return (
                  <button key={a.key} type="button" aria-pressed={on} onClick={() => setBasics({ ...basics, amenities: on ? basics.amenities.filter((x) => x !== a.key) : [...basics.amenities, a.key] })}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${on ? "border-forest bg-mint text-on-mint" : "border-line hover:border-line-strong"}`}>
                    <Icon name={a.key} size={16} />{a.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </StepShell>
    );
  }

  if (step === 1) {
    return (
      <StepShell step={1} title="Share your Wi-Fi" subtitle="Guests scan a QR code on the TV and they're online. No more spelling out passwords." saving={saving}
        onBack={() => go(0)} onSkip={() => { progress(2); go(2); }} onNext={() => saveStep(wifi, 2)}>
        <div className="grid gap-6 sm:grid-cols-[1fr_15rem]">
          <div className="space-y-4">
            {error && <ErrorBanner>{error}</ErrorBanner>}
            <Field label="Network name" hint="Exactly as it shows on your phone.">{(id, d) => <Input id={id} value={wifi.wifi_ssid} onChange={(e) => setWifi({ ...wifi, wifi_ssid: e.target.value })} autoComplete="off" spellCheck={false} aria-describedby={d} />}</Field>
            <Field label="Security">{(id) => (
              <Select id={id} value={wifi.wifi_security} onChange={(e) => setWifi({ ...wifi, wifi_security: e.target.value as Property["wifi_security"] })}>
                <option value="WPA">WPA / WPA2 (most routers)</option><option value="WEP">WEP</option><option value="nopass">No password</option>
              </Select>
            )}</Field>
            {wifi.wifi_security !== "nopass" && <Field label="Password">{(id) => <Input id={id} value={wifi.wifi_password} onChange={(e) => setWifi({ ...wifi, wifi_password: e.target.value })} autoComplete="off" spellCheck={false} className="font-mono" />}</Field>}
            {wifi.wifi_security !== "nopass" && <Toggle checked={wifi.show_wifi_password} onChange={(v) => setWifi({ ...wifi, show_wifi_password: v })} label="Show password on the TV" />}
          </div>
          <WifiQrPreview ssid={wifi.wifi_ssid} password={wifi.wifi_password} security={wifi.wifi_security || "WPA"} showPassword={wifi.show_wifi_password} />
        </div>
      </StepShell>
    );
  }

  if (step === 2) {
    const toggleRule = (r: HouseRule) => setRules((list) => (list.some((x) => x.text === r.text) ? list.filter((x) => x.text !== r.text) : [...list, r].slice(0, 6)));
    const toggleStep = (s: string) => setSteps((list) => (list.includes(s) ? list.filter((x) => x !== s) : [...list, s].slice(0, 6)));
    return (
      <StepShell step={2} title="House rules and check-out" subtitle="Pick a few now. You can write your own later." saving={saving}
        onBack={() => go(1)} onSkip={() => { progress(3); go(3); }} onNext={() => saveStep({ house_rules: rules, checkout_steps: steps, max_guests: maxGuests }, 3)}>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <p className="kb-label">House rules</p>
        <div className="flex flex-wrap gap-2">
          {RULES.map((r) => {
            const on = rules.some((x) => x.text === r.text);
            return <button key={r.text} type="button" aria-pressed={on} onClick={() => toggleRule(r)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${on ? "border-forest bg-mint text-on-mint" : "border-line"}`}><Icon name={r.icon} size={16} />{r.text}</button>;
          })}
        </div>
        <div className="mt-5 w-40"><Field label="Max guests">{(id) => <Input id={id} type="number" min={1} max={99} value={maxGuests} onChange={(e) => setMaxGuests(Math.max(0, Math.min(99, +e.target.value || 0)))} />}</Field></div>
        <p className="kb-label mt-5">Check-out steps</p>
        <div className="space-y-2">
          {STEPS_PRESET.map((s) => (
            <label key={s} className="flex cursor-pointer items-center gap-3 rounded-md border border-line px-4 py-3 text-sm hover:bg-surface-wash">
              <input type="checkbox" checked={steps.includes(s)} onChange={() => toggleStep(s)} className="h-5 w-5 accent-[#006a43]" />{s}
            </label>
          ))}
        </div>
      </StepShell>
    );
  }

  return (
    <StepShell step={3} title="Pair your TV" subtitle="Install the app on the TV, then type the code it shows." onBack={() => go(2)} onSkip={() => finish()} nextLabel="Finish" onNext={() => finish()}>
      <div className="rounded-md bg-surface-wash p-4"><InstallSteps /></div>
      <div className="mt-6">
        {property ? <PairTvForm properties={[property]} defaultProperty={property.id} onPaired={() => { reloadDevices(); finish(true); }} />
          : <p className="text-sm text-ink-muted">Go back and add your property first.</p>}
      </div>
      <p className="mt-4 text-sm text-ink-muted">No TV nearby? Open <b>{window.location.host}/tv</b> in any browser to try it.</p>
    </StepShell>
  );
}

export default function Onboarding() {
  return <DataProvider><Wizard /><UpgradeSheet /></DataProvider>;
}
