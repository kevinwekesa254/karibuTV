import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, errorMessage, mediaUrl, uploadMedia, MEDIA_BUCKET } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { prepareLogo, resizeImage } from "@/lib/image";
import { COUNTRIES, phoneValid, splitPhone } from "@/lib/countries";
import { passwordProblem } from "@/lib/password";
import type { CountryCode } from "@/lib/types";
import { Icon } from "@/components/Icons";
import { PhoneInput } from "@/components/PhoneInput";
import { AiConnect } from "./shared/AiConnect";
import { Button, Card, ConfirmModal, Field, Input, PageHeader, Select, Spinner, Tag } from "@/components/ui";

function Panel({ title, description, children, icon }: { title: string; description?: string; children: ReactNode; icon: string }) {
  return (
    <Card as="section" className="p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-mint-soft text-maroon"><Icon name={icon} size={20} /></span>
        <div>
          <h2 className="font-display text-xl font-semibold text-forest">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </Card>
  );
}

/** Round photo or square logo with upload / replace / remove. Saves straight to the profile. */
function ImageField({ label, hint, value, kind, round, onSaved }: { label: string; hint: string; value: string; kind: "avatar" | "business_logo"; round?: boolean; onSaved: () => Promise<void> }) {
  const { user } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  if (!user) return null;
  const save = async (path: string) => {
    const { error } = await supabase.from("profiles").update({ [kind]: path }).eq("id", user.id);
    if (error) throw error;
    if (value) supabase.storage.from(MEDIA_BUCKET).remove([value]).catch(() => {});
    await onSaved();
  };
  const upload = async (file?: File) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast("That file is over 8 MB. Pick a smaller image.", "error"); return; }
    setBusy(true);
    try {
      const prepared = kind === "avatar" ? await resizeImage(file, 512) : await prepareLogo(file);
      await save(await uploadMedia(user.id, "profile", kind, prepared));
      toast(kind === "avatar" ? "Photo saved." : "Logo saved.");
    } catch (e) { toast(errorMessage(e, "Upload failed."), "error"); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  };
  const id = `${kind}-in`;
  return (
    <div className="flex items-center gap-4">
      <div className={`relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border border-line bg-surface-wash ${round ? "rounded-full" : "rounded-md"}`}>
        {value ? <img src={mediaUrl(value)} alt="" className={`h-full w-full ${round ? "object-cover" : "object-contain p-2"}`} /> : <Icon name={round ? "user" : "image"} size={26} className="text-ink-muted" />}
        {busy && <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-maroon"><Spinner size={18} /></div>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-ink-muted">{hint}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input ref={input} id={id} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
          <label htmlFor={id} className="kb-btn kb-btn--secondary kb-btn--sm cursor-pointer"><Icon name="upload" size={14} />{value ? "Replace" : "Upload"}</label>
          {value && <Button size="sm" variant="ghost" onClick={async () => { setBusy(true); try { await save(""); toast("Removed."); } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); } }}>Remove</Button>}
        </div>
      </div>
    </div>
  );
}

/** Authenticator-app two-step verification (TOTP). Required for admins, recommended for hosts. */
function TwoStep() {
  const toast = useToast();
  const [factors, setFactors] = useState<{ id: string; friendly_name?: string | null }[] | null>(null);
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => supabase.auth.mfa.listFactors().then(({ data }) => setFactors((data?.totp || []).filter((f) => f.status === "verified")));
  useEffect(() => { load(); }, []);

  const start = async () => {
    setBusy(true);
    try {
      // Clear any half-finished setup first.
      const { data: all } = await supabase.auth.mfa.listFactors();
      for (const f of all?.all || []) if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Karibu TV ${new Date().toISOString().slice(0, 10)}` });
      if (error) throw error;
      if (data.type !== "totp") throw new Error("Couldn't start authenticator setup.");
      setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };
  const verify = async (e: FormEvent) => {
    e.preventDefault();
    if (!enroll) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.id, code: code.replace(/\s/g, "") });
      if (error) throw error;
      setEnroll(null); setCode(""); await load();
      toast("Two-step verification is on.");
    } catch (err) { toast(errorMessage(err, "That code didn't work. Check the time on your phone and try again."), "error"); } finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    setBusy(true);
    try { const { error } = await supabase.auth.mfa.unenroll({ factorId: id }); if (error) throw error; await load(); toast("Two-step verification is off."); }
    catch (e) { toast(errorMessage(e, "Sign out and in again with your code, then try once more."), "error"); } finally { setBusy(false); }
  };

  if (factors === null) return <Spinner />;
  if (enroll) {
    return (
      <form onSubmit={verify} className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
        <img src={enroll.qr} alt="Scan this QR code with your authenticator app" className="h-44 w-44 rounded-md border border-line bg-white p-2" />
        <div className="space-y-3">
          <p className="text-sm">Scan with Google Authenticator, Microsoft Authenticator, Authy or 1Password. No camera? Enter this key:</p>
          <code className="block break-all rounded-sm bg-surface-wash px-3 py-2 text-sm">{enroll.secret}</code>
          <Field label="6-digit code from the app">{(id) => <Input id={id} value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7} className="max-w-[12rem] text-center font-display text-xl tracking-[0.3em]" />}</Field>
          <div className="flex gap-2"><Button type="submit" loading={busy} disabled={code.replace(/\s/g, "").length !== 6}>Turn on</Button><Button variant="ghost" onClick={() => setEnroll(null)}>Cancel</Button></div>
        </div>
      </form>
    );
  }
  return factors.length ? (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="flex items-center gap-2 text-sm"><Tag>On</Tag>You'll be asked for a code from your authenticator app when you sign in.</p>
      <Button variant="ghost" size="sm" loading={busy} onClick={() => remove(factors[0].id)}>Turn off</Button>
    </div>
  ) : (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-ink-muted">Protect your account and your guests' details with a code from your phone.</p>
      <Button icon="shield" loading={busy} onClick={start}>Set up</Button>
    </div>
  );
}

export default function Settings() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [p, setP] = useState({ name: "", business_name: "", whatsapp: "", country: "KE" as CountryCode });
  const [pw, setPw] = useState({ old: "", next: "" });
  const [busy, setBusy] = useState("");
  const [del, setDel] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => { if (profile) setP({ name: profile.name, business_name: profile.business_name || "", whatsapp: profile.whatsapp, country: profile.country || "KE" }); }, [profile]);
  if (!user || !profile) return null;
  const sp = splitPhone(p.whatsapp, p.country);
  const phoneErr = p.whatsapp && !phoneValid(sp.country, sp.local) ? "Check the number after the country code." : "";

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (phoneErr) return;
    setBusy("profile");
    try {
      const { error } = await supabase.from("profiles").update({ name: p.name.trim().slice(0, 80), business_name: p.business_name.trim().slice(0, 80), whatsapp: p.whatsapp, country: p.country }).eq("id", user.id);
      if (error) throw error;
      await refreshProfile(); toast("Profile saved.");
    } catch (err) { toast(errorMessage(err), "error"); }
    finally { setBusy(""); }
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    const problem = passwordProblem(pw.next, user.email || "");
    if (problem) { toast(problem, "error"); return; }
    setBusy("pw");
    try {
      const { error: e1 } = await supabase.auth.signInWithPassword({ email: user.email || "", password: pw.old });
      if (e1) throw new Error("Your current password isn't right.");
      const { error: e2 } = await supabase.auth.updateUser({ password: pw.next });
      if (e2) throw e2;
      setPw({ old: "", next: "" });
      toast("Password changed.");
    } catch (err) { toast(errorMessage(err, "Check your current password and try again."), "error"); }
    finally { setBusy(""); }
  };

  const deleteAccount = async () => {
    setBusy("del");
    try {
      const { data: devs } = await supabase.from("devices").select("id");
      for (const d of devs || []) await supabase.rpc("device_unlink", { p_device: d.id });
      const { error } = await supabase.from("properties").delete().eq("owner_id", user.id);
      if (error) throw error;
      await supabase.from("pms_requests").delete().eq("user_id", user.id);
      await supabase.from("profiles").delete().eq("id", user.id);
      await signOut();
      nav("/", { replace: true });
    } catch (err) { toast(errorMessage(err), "error"); setBusy(""); }
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" subtitle="Your profile, business details and account security." />
      <div className="space-y-5">
        <Panel icon="user" title="Profile" description="How you appear in the dashboard and to our support team.">
          <form onSubmit={saveProfile} className="space-y-5">
            <ImageField label="Your photo" hint="Square, at least 256 px. JPG or PNG." value={profile.avatar} kind="avatar" round onSaved={refreshProfile} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your name">{(id) => <Input id={id} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} autoComplete="name" maxLength={80} />}</Field>
              <Field label="Country" hint="Sets your phone prefix and currency.">{(id) => (
                <Select id={id} value={p.country} onChange={(e) => setP({ ...p, country: e.target.value as CountryCode })}>
                  {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}<option value="other">Other</option>
                </Select>
              )}</Field>
            </div>
            <Field label="WhatsApp" optional error={phoneErr}>{(id, d) => <PhoneInput id={id} value={p.whatsapp} country={p.country} onChange={(v) => setP((x) => ({ ...x, whatsapp: v }))} onCountryChange={(c) => setP((x) => ({ ...x, country: c }))} describedBy={d} invalid={!!phoneErr} />}</Field>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-ink-muted">Email:</span><span className="font-semibold">{user.email}</span>
              {user.email_confirmed_at ? <Tag>Verified</Tag> : (
                <>
                  <Tag tone="warning">Not verified</Tag>
                  <button type="button" className="font-semibold text-maroon underline" onClick={() => supabase.auth.resend({ type: "signup", email: user.email || "" }).then(({ error }) => toast(error ? errorMessage(error) : "Verification email sent.", error ? "error" : "success"))}>Resend link</button>
                </>
              )}
            </div>
            <Button type="submit" loading={busy === "profile"}>Save profile</Button>
          </form>
        </Panel>

        <Panel icon="building" title="Business" description="Your hosting business. The logo shows in your dashboard; each property's TV logo is set on TV Screens.">
          <div className="space-y-5">
            <ImageField label="Business logo" hint="PNG with a transparent background looks best." value={profile.business_logo} kind="business_logo" onSaved={refreshProfile} />
            <form onSubmit={saveProfile} className="flex flex-wrap items-end gap-3">
              <Field label="Business name" optional className="min-w-[16rem] flex-1">{(id) => <Input id={id} value={p.business_name} onChange={(e) => setP({ ...p, business_name: e.target.value })} maxLength={80} placeholder="e.g. Serengeti Stays" />}</Field>
              <Button type="submit" variant="secondary" loading={busy === "profile"}>Save</Button>
            </form>
          </div>
        </Panel>

        <Panel icon="sparkle" title="AI assistant" description="Connect your own Claude or ChatGPT account to get AI tips and suggestions on the Insights page.">
          <AiConnect />
        </Panel>

        <Panel icon="shield" title="Two-step verification" description="A 6-digit code from your phone, on top of your password.">
          <TwoStep />
        </Panel>

        <Panel icon="lock" title="Password and sessions">
          <form onSubmit={savePassword} className="grid gap-4 sm:grid-cols-2">
            <Field label="Current password">{(id) => <Input id={id} type="password" value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} autoComplete="current-password" />}</Field>
            <Field label="New password" hint="10+ characters, letters and numbers.">{(id, d) => <Input id={id} type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" aria-describedby={d} />}</Field>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="submit" variant="secondary" loading={busy === "pw"} disabled={!pw.old || !pw.next}>Change password</Button>
              <Button variant="ghost" icon="logout" onClick={async () => { await supabase.auth.signOut({ scope: "global" }); nav("/signin", { replace: true }); }}>Sign out on all devices</Button>
            </div>
          </form>
        </Panel>

        <Panel icon="delete" title="Delete account" description="Deletes your properties, bookings, calendars and TV links. Paired TVs go back to the pairing screen. To remove your login too, email us and we'll erase it within 7 days.">
          <Button variant="danger" icon="delete" onClick={() => setDel(true)}>Delete my account</Button>
        </Panel>
      </div>
      <ConfirmModal open={del} onClose={() => { setDel(false); setConfirmText(""); }} onConfirm={() => confirmText === "DELETE" && deleteAccount()} loading={busy === "del"} danger confirmLabel="Delete everything"
        title="Delete your account?" body={<>
          <p>Everything is deleted straight away.</p>
          <Field label="Type DELETE to confirm" className="mt-4">{(id) => <Input id={id} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />}</Field>
        </>} />
    </div>
  );
}
