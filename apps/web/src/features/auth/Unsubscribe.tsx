import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icons";
import { Spinner } from "@/components/ui";

/** One-click opt-out from the link at the bottom of reminder and newsletter emails. No sign-in needed. */
export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("t") || "";
  const kind = params.get("k") === "marketing" ? "marketing" : "reminders";
  const [state, setState] = useState<"busy" | "done" | "bad">("busy");
  useEffect(() => {
    supabase.rpc("email_unsubscribe", { p_token: token, p_kind: kind })
      .then(({ data, error }) => setState(!error && (data as { ok?: boolean })?.ok ? "done" : "bad"));
  }, [token, kind]);
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-surface-wash px-4 py-12">
      <div className="w-full max-w-md rounded-lg border border-line bg-surface p-8 text-center shadow-panel">
        <div className="mb-6 flex justify-center"><Logo /></div>
        {state === "busy" && <div className="flex justify-center text-maroon"><Spinner size={22} /></div>}
        {state === "done" && <>
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-mint-soft text-maroon"><Icon name="check" size={22} /></span>
          <h1 className="mt-4 font-display text-2xl font-semibold text-forest">You're unsubscribed</h1>
          <p className="mt-2 text-ink-muted">
            {kind === "marketing" ? "We won't send you tips and offers any more." : "We won't send you trial, renewal or offline-TV reminders any more."}{" "}
            Receipts and support replies still reach you.
          </p>
          <p className="mt-4 text-sm text-ink-muted">Changed your mind? Turn emails back on in <Link to="/app/settings" className="font-semibold text-maroon underline">Settings</Link>.</p>
        </>}
        {state === "bad" && <>
          <h1 className="font-display text-2xl font-semibold text-forest">That link didn't work</h1>
          <p className="mt-2 text-ink-muted">It may be incomplete. Sign in and choose your emails in <Link to="/app/settings" className="font-semibold text-maroon underline">Settings</Link>, or reply to any of our emails and we'll do it for you.</p>
        </>}
      </div>
    </main>
  );
}
