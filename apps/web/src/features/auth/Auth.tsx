import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase, errorMessage, supabaseConfigured } from "@/lib/supabase";
import { Logo } from "@/components/Logo";
import { Button, ErrorBanner, Field, Input, Select } from "@/components/ui";
import { Icon } from "@/components/Icons";

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

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (err) throw err;
      nav(params.get("next") || "/app", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally { setLoading(false); }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to manage your TVs and guests."
      footer={<>New to Karibu? <Link to="/signup" className="font-semibold text-green underline">Create a free account</Link></>}>
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
  const [f, setF] = useState({ name: "", email: "", whatsapp: "", country: "KE", password: "" });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const blur = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));

  const errs = {
    name: !f.name.trim() ? "Add your name so guests know who's hosting." : "",
    email: !emailOk(f.email) ? "Enter an email like amina@example.com." : "",
    whatsapp: f.whatsapp && !/^\+?\d[\d\s-]{7,16}$/.test(f.whatsapp.trim()) ? "Use a number like +254 712 345 678." : "",
    password: f.password.length < 8 ? "Use at least 8 characters." : "",
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true, whatsapp: true, password: true });
    if (Object.values(errs).some(Boolean)) return;
    setError("");
    setLoading(true);
    try {
      const wa = f.whatsapp.replace(/[\s-]/g, "");
      const whatsapp = wa ? (wa.startsWith("+") ? wa : wa.startsWith("0") && f.country === "KE" ? "+254" + wa.slice(1) : "+" + wa) : "";
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
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <Field label="Your name" error={touched.name ? errs.name : ""}>{(id, d) => <Input id={id} value={f.name} onChange={(e) => set("name")(e.target.value)} onBlur={blur("name")} autoComplete="name" aria-describedby={d} invalid={touched.name && !!errs.name} />}</Field>
        <Field label="Email" error={touched.email ? errs.email : ""}>{(id, d) => <Input id={id} type="email" value={f.email} onChange={(e) => set("email")(e.target.value)} onBlur={blur("email")} autoComplete="email" inputMode="email" aria-describedby={d} invalid={touched.email && !!errs.email} />}</Field>
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Field label="WhatsApp" optional error={touched.whatsapp ? errs.whatsapp : ""} hint="For setup help.">{(id, d) => <Input id={id} type="tel" value={f.whatsapp} onChange={(e) => set("whatsapp")(e.target.value)} onBlur={blur("whatsapp")} autoComplete="tel" inputMode="tel" placeholder="+254 712 345 678" aria-describedby={d} invalid={touched.whatsapp && !!errs.whatsapp} />}</Field>
          <Field label="Country">{(id) => (
            <Select id={id} value={f.country} onChange={(e) => set("country")(e.target.value)}>
              <option value="KE">Kenya</option><option value="TZ">Tanzania</option><option value="UG">Uganda</option><option value="RW">Rwanda</option><option value="other">Other</option>
            </Select>
          )}</Field>
        </div>
        <Field label="Password" error={touched.password ? errs.password : ""} hint="At least 8 characters.">{(id, d) => <PasswordInput id={id} value={f.password} onChange={set("password")} onBlur={blur("password")} autoComplete="new-password" describedBy={d} invalid={touched.password && !!errs.password} />}</Field>
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
    if (pw.length < 8) { setError("Use at least 8 characters."); return; }
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
        <Field label="New password" hint="At least 8 characters.">{(id, d) => <PasswordInput id={id} value={pw} onChange={setPw} autoComplete="new-password" describedBy={d} />}</Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>Save password</Button>
      </form>
    </AuthShell>
  );
}
