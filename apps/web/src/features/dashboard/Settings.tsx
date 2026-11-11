import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, errorMessage } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { Button, Card, ConfirmModal, Field, Input, PageHeader, Select, Tag } from "@/components/ui";
import { phoneOk } from "./Properties";

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card as="section" className="p-5 sm:p-6">
      <h2 className="font-display text-xl font-semibold text-forest">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </Card>
  );
}

export default function Settings() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [p, setP] = useState({ name: "", whatsapp: "", country: "KE" });
  const [pw, setPw] = useState({ old: "", next: "" });
  const [busy, setBusy] = useState("");
  const [del, setDel] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => { if (profile) setP({ name: profile.name, whatsapp: profile.whatsapp, country: profile.country || "KE" }); }, [profile]);
  if (!user) return null;

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!phoneOk(p.whatsapp)) { toast("Use a WhatsApp number like +254 712 345 678.", "error"); return; }
    setBusy("profile");
    try {
      const { error } = await supabase.from("profiles").update({ name: p.name.trim(), whatsapp: p.whatsapp.replace(/[\s-]/g, ""), country: p.country }).eq("id", user.id);
      if (error) throw error;
      await refreshProfile(); toast("Profile saved.");
    }
    catch (err) { toast(errorMessage(err), "error"); }
    finally { setBusy(""); }
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (pw.next.length < 8) { toast("Use at least 8 characters for the new password.", "error"); return; }
    setBusy("pw");
    try {
      // Confirm the current password before changing it.
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
      // Unlink TVs so they return to the pairing screen, then delete properties (bookings and calendars cascade).
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
    <div className="max-w-2xl">
      <PageHeader title="Settings" />
      <div className="space-y-5">
        <Panel title="Profile">
          <form onSubmit={saveProfile} className="space-y-4">
            <Field label="Name">{(id) => <Input id={id} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} autoComplete="name" />}</Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="WhatsApp" optional>{(id) => <Input id={id} type="tel" value={p.whatsapp} onChange={(e) => setP({ ...p, whatsapp: e.target.value })} placeholder="+254 712 345 678" />}</Field>
              <Field label="Country" hint="Sets your currency.">{(id) => (
                <Select id={id} value={p.country} onChange={(e) => setP({ ...p, country: e.target.value })}>
                  <option value="KE">Kenya</option><option value="TZ">Tanzania</option><option value="UG">Uganda</option><option value="RW">Rwanda</option><option value="other">Other</option>
                </Select>
              )}</Field>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-ink-muted">Email:</span><span className="font-semibold">{user.email}</span>
              {user.email_confirmed_at ? <Tag>Verified</Tag> : (
                <>
                  <Tag tone="warning">Not verified</Tag>
                  <button type="button" className="font-semibold text-green underline" onClick={() => supabase.auth.resend({ type: "signup", email: user.email || "" }).then(({ error }) => toast(error ? errorMessage(error) : "Verification email sent.", error ? "error" : "success"))}>Resend link</button>
                </>
              )}
            </div>
            <Button type="submit" loading={busy === "profile"}>Save profile</Button>
          </form>
        </Panel>

        <Panel title="Password">
          <form onSubmit={savePassword} className="space-y-4">
            <Field label="Current password">{(id) => <Input id={id} type="password" value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} autoComplete="current-password" />}</Field>
            <Field label="New password" hint="At least 8 characters.">{(id, d) => <Input id={id} type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" aria-describedby={d} />}</Field>
            <Button type="submit" variant="secondary" loading={busy === "pw"} disabled={!pw.old || !pw.next}>Change password</Button>
          </form>
        </Panel>

        <Panel title="Delete account" description="Deletes your properties, bookings, calendars and TV links. Paired TVs go back to the pairing screen. To remove your login too, email us and we'll erase it within 7 days.">
          <Button variant="danger" icon="delete" onClick={() => setDel(true)}>Delete my account</Button>
        </Panel>
      </div>
      <ConfirmModal open={del} onClose={() => { setDel(false); setConfirmText(""); }} onConfirm={() => confirmText === "DELETE" && deleteAccount()} loading={busy === "del"} danger confirmLabel="Delete everything"
        title="Delete your account?" body={<>
          <p>Everything is deleted straight away.</p>
          <Field label='Type DELETE to confirm' className="mt-4">{(id) => <Input id={id} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />}</Field>
        </>} />
    </div>
  );
}
