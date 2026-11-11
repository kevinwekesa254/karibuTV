import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { BRAND } from "@/lib/brand";

function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="kb-band rounded-b-band px-4 py-6"><div className="mx-auto max-w-3xl"><Logo /></div></header>
      <main className="mx-auto max-w-3xl px-4 py-12 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-forest [&_li]:mt-1 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
        <h1 className="font-display text-display-md text-forest">{title}</h1>
        <p className="text-sm text-ink-muted">Last updated {updated}. Draft for review before launch.</p>
        {children}
        <p className="mt-10"><Link to="/" className="font-semibold text-green underline">Back to {BRAND.name}</Link></p>
      </main>
    </div>
  );
}

export function Privacy() {
  return (
    <LegalPage title="Privacy notice" updated="9 November 2026">
      <p>{BRAND.name} helps holiday-rental hosts show a welcome screen on their TV. This notice explains what we keep and why, in line with Kenya's Data Protection Act, 2019.</p>
      <h2>What we keep about hosts</h2>
      <ul><li>Name, email, WhatsApp number and country, to run your account and help you set up.</li><li>Your property details, Wi-Fi details, house rules and screen settings, to show them on your TV.</li><li>Payment records, when payments are switched on.</li></ul>
      <h2>What we keep about guests</h2>
      <ul><li>Only the guest's first name and the stay dates you enter or that come from your booking calendar.</li><li>We delete stays automatically 30 days after check-out.</li><li>Private notes you add to a booking are never shown on the TV.</li></ul>
      <h2>TVs</h2>
      <p>Each paired TV sends a heartbeat every few minutes (app version, screen size, last seen time) so you can see whether it's online.</p>
      <h2>Who we share data with</h2>
      <p>We don't sell data. We use a hosting provider in the EU, MET Norway for weather (only your property's approximate location) and OpenStreetMap to look up that location.</p>
      <h2>Your rights</h2>
      <p>You can see, correct or delete your data at any time from Settings, or ask us at {BRAND.email}. Deleting your account deletes everything straight away.</p>
    </LegalPage>
  );
}

export function Terms() {
  return (
    <LegalPage title="Terms of use" updated="9 November 2026">
      <p>By creating an account you agree to these terms.</p>
      <h2>The service</h2>
      <p>{BRAND.name} shows information you provide on TVs you pair. You're responsible for what you put on the screen and for having your guests' permission to show their first name.</p>
      <h2>Plans</h2>
      <p>The Free plan includes 1 TV and 1 property. Pro is billed per TV. If Pro lapses, calendar sync pauses and TVs beyond the Free limit show a renewal note instead of guest details.</p>
      <h2>Availability</h2>
      <p>We work hard to keep the service running. TVs keep showing the last screen when the internet drops, but we can't promise uninterrupted service.</p>
      <h2>Ending your account</h2>
      <p>You can delete your account at any time in Settings. We may suspend accounts that misuse the service.</p>
      <h2>Contact</h2>
      <p>{BRAND.email}</p>
    </LegalPage>
  );
}
