import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase, errorMessage, supabaseConfigured } from "@/lib/supabase";
import { Logo } from "@/components/Logo";
import { Button, ErrorBanner, Field, Input, Select } from "@/components/ui";
import { Icon } from "@/components/Icons";
import { PhoneInput } from "@/components/PhoneInput";
import { COUNTRIES, phoneValid, splitPhone } from "@/lib/countries";
import { passwordProblem, passwordScore } from "@/lib/password";
import type { CountryCode } from "@/lib/types";

function StrengthBar({ pw }: { pw: string }) {
  const s = passwordScore(pw);
  if (!pw) return null;
  const label = ["Weak", "Weak", "Fair", "Good", "Strong"][s];
  return (
    <div className="mt-2 flex items-center gap-3" aria-live="polite">
      <div className="flex flex-1 gap-1">{[0, 1, 2, 3].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i < s ? (s >= 3 ? "bg-maroon" : "bg-warning") : "bg-line"}`} />)}</div>
      <span className="text-xs font-semibold text-ink-muted">{label}</span>
    </div>
  );
}

type OAuthProvider = "google" | "apple" | "facebook" | "azure";
const OAUTH: Record<OAuthProvider, { label: string; icon: string; className: string }> = {
  google: { label: "Google", icon: "google", className: "bg-white text-ink border-line-strong/60 hover:bg-surface-wash" },
  apple: { label: "Apple", icon: "apple", className: "bg-[#0b0b0f] text-white border-[#0b0b0f] hover:bg-black" },
  facebook: { label: "Facebook", icon: "facebook", className: "bg-[#1877f2] text-white border-[#1877f2] hover:bg-[#1468d6]" },
  azure: { label: "Microsoft", icon: "microsoft", className: "bg-white text-ink border-line-strong/60 hover:bg-surface-wash" },
};
// Which buttons to show: only providers switched on in Supabase (Authentication > Providers).
const ENABLED = ((import.meta.env.VITE_OAUTH_PROVIDERS as string | undefined) ?? "google,apple")
  .split(",").map((x) => x.trim()).filter((x): x is OAuthProvider => x in OAUTH);

/** "Continue with Google / Apple…". New accounts get the same 30-day Pro trial; onboarding asks for the rest. */
function SocialButtons({ next = "/app" }: { next?: string }) {
  const [busy, setBusy] = useState<OAuthProvider | "">("");
  const [error, setError] = useState("");
  if (!ENABLED.length) return null;
  const go = async (provider: OAuthProvider) => {
    setBusy(provider); setError("");
    const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/app";
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}${safeNext}`, ...(provider === "azure" ? { scopes: "email" } : {}) },
    });
    if (err) { setError(errorMessage(err)); setBusy(""); }
  };
  return (
    <div className="space-y-3">
      {error && <ErrorBanner>{error}</ErrorBanner>}
      <div className="grid gap-2">
        {ENABLED.map((p) => (
          <button key={p} type="button" onClick={() => go(p)} disabled={!!busy}
            className={`flex min-h-[46px] items-center justify-center gap-2.5 rounded-full border-[1.5px] px-4 text-[0.9375rem] font-semibold transition-colors disabled:opacity-60 ${OAUTH[p].className}`}>
            <i className={`fi fi-brands-${OAUTH[p].icon} inline-flex text-[18px] leading-none`} aria-hidden />
            {busy === p ? "Opening…" : `Continue with ${OAUTH[p].label}`}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-ink-muted"><span className="h-px flex-1 bg-line" />or with email<span className="h-px flex-1 bg-line" /></div>
    </div>
  );
}

/** Full-page code prompt, used by the app's route guard (covers Google / Apple sign-ins too). */
export function MfaScreen({ onDone }: { onDone: () => void }) {
  return <AuthShell title="Two-step verification"><MfaStep onDone={onDone} /></AuthShell>;
}

/** Second step when the account has two-step verification on. */
function MfaStep({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const { data: f, error: fe } = await supabase.auth.mfa.listFactors();
      if (fe) throw fe;
      const factor = f.totp.find((x) => x.status === "verified");
      if (!factor) throw new Error("No authenticator app is set up on this account.");
      const { error: ve } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.replace(/\s/g, "") });
      if (ve) throw ve;
      onDone();
    } catch (err) { setError(errorMessage(err)); } finally { setLoading(false); }
  };
  return (
    <form onSubmit={verify} className="space-y-4" noValidate>
      {error && <ErrorBanner>{error}</ErrorBanner>}
      <p className="text-ink-muted">Open your authenticator app (Google Authenticator, Authy, 1Password…) and type the 6-digit code for Karibu TV.</p>
      <Field label="6-digit code">{(id) => <Input id={id} value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7} autoFocus className="text-center font-display text-2xl tracking-[0.4em]" />}</Field>
      <Button type="submit" size="lg" className="w-full" loading={loading} disabled={code.replace(/\s/g, "").length !== 6}>Verify</Button>
      <button type="button" onClick={() => supabase.auth.signOut().then(() => window.location.reload())} className="w-full text-sm font-semibold text-ink-muted underline">Use another account</button>
    </form>
  );
}

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-wash">
      <div className="kb-band rounded-b-band px-4 pb-24 pt-6 sm:px-8">
        <div className="mx-auto max-w-md"><Logo /></div>
      </div>
      <main className="mx-auto -mt-16 max-w-md px-4 pb-16">
        <div className="kb-card p-6 shadow-panel sm:p-8">
          <h1 className="font-display text-display-sm text-forest">{title}</h1>
          {subtitle && <p className="mt-1 text-ink-muted">{subtitle}</p>}
          {!supabaseConfigured && <div className="mt-4"><ErrorBanner>Supabase isn't connected yet: add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</ErrorBanner></div>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-6 text-center text-sm text-ink-muted">{footer}</div>}
      </main>
    </div>
  );
}

function PasswordInput({ id, value, onChange, autoComplete, describedBy, invalid, onBlur }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string; describedBy?: string; invalid?: boolean; onBlur?: () => void }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete}
        aria-describedby={describedBy} invalid={invalid} onBlur={onBlur} required className="pr-12" />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-ink-muted hover:bg-mint-soft"
        aria-label={show ? "Hide password" : "Show password"}>
        <Icon name={show ? "eye-off" : "eye"} size={18} />
      </button>
    </div>
  );
}

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export function SignIn() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mfa, setMfa] = useState(false);
  const next = () => { const n = params.get("next") || "/app"; nav(n.startsWith("/") && !n.startsWith("//") ? n : "/app", { replace: true }); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (err) throw err;
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") { setMfa(true); return; }
      next();
    } catch (err) {
      setError(errorMessage(err));
    } finally { setLoading(false); }
  };

  if (mfa) return <AuthShell title="Two-step verification"><MfaStep onDone={next} /></AuthShell>;
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to manage your TVs and guests."
      footer={<>New to Karibu? <Link to="/signup" className="font-semibold text-green underline">Create a free account</Link></>}>
      <SocialButtons next={params.get("next") || "/app"} />
      <div className="mt-5" />
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <Field label="Email">{(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" required />}</Field>
        <Field label="Password">{(id) => <PasswordInput id={id} value={password} onChange={setPassword} autoComplete="current-password" />}</Field>
        <div className="flex justify-end"><Link to="/reset" className="text-sm font-semibold text-green underline">Forgot password?</Link></div>
        <Button type="submit" size="lg" className="w-full" loading={loading}>Sign in</Button>
      </form>
    </AuthShell>
  );
}

export function SignUp() {
  const nav = useNavigate();
  const [f, setF] = useState({ name: "", email: "", whatsapp: "", country: "KE" as CountryCode, password: "" });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const blur = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));

  const errs = {
    name: !f.name.trim() ? "Add your name so guests know who's hosting." : "",
    email: !emailOk(f.email) ? "Enter an email like amina@example.com." : "",
    whatsapp: f.whatsapp && !phoneValid(splitPhone(f.whatsapp).country, splitPhone(f.whatsapp).local) ? "Check the number: digits after the country code, e.g. 712 345 678." : "",
    password: passwordProblem(f.password, f.email),
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true, whatsapp: true, password: true });
    if (Object.values(errs).some(Boolean)) return;
    setError("");
    setLoading(true);
    try {
      const whatsapp = f.whatsapp;
      const { data, error: err } = await supabase.auth.signUp({
        email: f.email.trim(), password: f.password,
        options: { data: { name: f.name.trim(), whatsapp, country: f.country }, emailRedirectTo: `${window.location.origin}/app` },
      });
      if (err) throw err;
      if (!data.session) { setConfirm(f.email.trim()); return; }
      nav("/app/welcome", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally { setLoading(false); }
  };

  if (confirm) {
    return (
      <AuthShell title="Check your email" footer={<Link to="/signin" className="font-semibold text-green underline">Back to sign in</Link>}>
        <p className="text-ink">We sent a confirmation link to <b>{confirm}</b>. Open it on this device to finish setting up your account.</p>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Start free" subtitle="30 days of Pro on us, then 1 TV and 1 property free forever. No card needed."
      footer={<>Already have an account? <Link to="/signin" className="font-semibold text-green underline">Sign in</Link></>}>
      <SocialButtons next="/app" />
      <div className="mt-5" />
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <Field label="Your name" error={touched.name ? errs.name : ""}>{(id, d) => <Input id={id} value={f.name} onChange={(e) => set("name")(e.target.value)} onBlur={blur("name")} autoComplete="name" aria-describedby={d} invalid={touched.name && !!errs.name} />}</Field>
        <Field label="Email" error={touched.email ? errs.email : ""}>{(id, d) => <Input id={id} type="email" value={f.email} onChange={(e) => set("email")(e.target.value)} onBlur={blur("email")} autoComplete="email" inputMode="email" aria-describedby={d} invalid={touched.email && !!errs.email} />}</Field>
        <Field label="Country">{(id) => (
          <Select id={id} value={f.country} onChange={(e) => setF((x) => ({ ...x, country: e.target.value as CountryCode }))}>
            {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}<option value="other">Other</option>
          </Select>
        )}</Field>
        <Field label="WhatsApp" optional error={touched.whatsapp ? errs.whatsapp : ""} hint="For setup help. The prefix follows your country.">{(id, d) => (
          <PhoneInput id={id} value={f.whatsapp} country={f.country} onChange={set("whatsapp")} onCountryChange={(c) => setF((x) => ({ ...x, country: c }))} describedBy={d} invalid={touched.whatsapp && !!errs.whatsapp} />
        )}</Field>
        <Field label="Password" error={touched.password ? errs.password : ""} hint="At least 10 characters, with letters and numbers.">{(id, d) => <><PasswordInput id={id} value={f.password} onChange={set("password")} onBlur={blur("password")} autoComplete="new-password" describedBy={d} invalid={touched.password && !!errs.password} /><StrengthBar pw={f.password} /></>}</Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>Create account</Button>
        <p className="text-center text-xs text-ink-muted">By signing up you agree to our <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy notice</Link>.</p>
      </form>
    </AuthShell>
  );
}

export function Reset() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!emailOk(email)) { setError("Enter the email you signed up with."); return; }
    setLoading(true); setError("");
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset/new` });
      if (err) throw err;
      setSent(true);
    }
    catch (err) { setError(errorMessage(err)); }
    finally { setLoading(false); }
  };
  return (
    <AuthShell title="Reset your password" subtitle={sent ? undefined : "We'll email you a link to choose a new one."}
      footer={<Link to="/signin" className="font-semibold text-green underline">Back to sign in</Link>}>
      {sent ? (
        <p className="text-ink">If <b>{email}</b> has an account, a reset link is on its way. Check your inbox and spam folder.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <Field label="Email">{(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />}</Field>
          <Button type="submit" size="lg" className="w-full" loading={loading}>Send reset link</Button>
        </form>
      )}
    </AuthShell>
  );
}

export function ConfirmReset() {
  const nav = useNavigate();
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = passwordProblem(pw);
    if (problem) { setError(problem); return; }
    setLoading(true); setError("");
    const { error: err } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (err) { setError(/session/i.test(err.message) ? "This link has expired. Request a new one." : errorMessage(err)); return; }
    nav("/app", { replace: true });
  };
  return (
    <AuthShell title="Choose a new password">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <ErrorBanner action={<Link to="/reset" className="font-semibold underline">New link</Link>}>{error}</ErrorBanner>}
        <Field label="New password" hint="At least 10 characters, with letters and numbers.">{(id, d) => <><PasswordInput id={id} value={pw} onChange={setPw} autoComplete="new-password" describedBy={d} /><StrengthBar pw={pw} /></>}</Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>Save password</Button>
      </form>
    </AuthShell>
  );
}
