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
        <p className="text-sm text-ink-muted">Last updated {updated}.</p>
        {children}
        <p className="mt-10 text-sm text-ink-muted">{BRAND.name} is a product of {BRAND.company}, {BRAND.address}. {BRAND.email} · WhatsApp {BRAND.supportWhatsApp}</p>
        <p className="mt-4"><Link to="/" className="font-semibold text-green underline">Back to {BRAND.name}</Link></p>
      </main>
    </div>
  );
}

export function Privacy() {
  return (
    <LegalPage title="Privacy notice" updated="13 November 2026">
      <p>{BRAND.name} helps holiday-rental hosts show a welcome screen on their TV. This notice explains what we keep and why, in line with Kenya's Data Protection Act, 2019.</p>
      <h2>What we keep about hosts</h2>
      <ul><li>Name, email, WhatsApp number and country, to run your account and help you set up.</li><li>Your property details, Wi-Fi details, house rules and screen settings, to show them on your TV.</li><li>Payment records: amount, date and how you paid (M-Pesa or card type and last 4 digits). Card and M-Pesa details are handled by our licensed payment partner; we never see your full card number or PIN.</li></ul>
      <h2>What we keep about guests</h2>
      <ul><li>Only the guest's first name and the stay dates you enter or that come from your booking calendar.</li><li>We delete stays automatically 30 days after check-out.</li><li>Private notes you add to a booking are never shown on the TV.</li></ul>
      <h2>TVs</h2>
      <p>Each paired TV sends a heartbeat every few minutes (app version, screen size, last seen time) so you can see whether it's online.</p>
      <h2>Who we share data with</h2>
      <p>We don't sell data. We use trusted service providers only to run Karibu TV: secure hosting in the EU, a licensed payment partner, an email delivery service, and weather and map services (which only receive your property's approximate location). Each one handles data only on our instructions. Ask us at any time for the full list.</p>
      <h2>Cookies and analytics</h2>
      <p>If you click Accept on our cookie notice, we use a web analytics service (Google Analytics) to count visits and see which pages are useful. It records pages viewed, roughly where you are (country and city), your device and how you found us. We don't send names, emails or booking details to Google, and guests' TV screens and guide pages are never tracked. Click No thanks and nothing is loaded. To change your mind, clear this site's data in your browser.</p>
      <h2>Your rights</h2>
      <p>You can see, correct or delete your data at any time from Settings, or ask us at {BRAND.email}. Deleting your account deletes everything straight away.</p>
    </LegalPage>
  );
}

export function Terms() {
  return (
    <LegalPage title="Terms of use" updated="14 November 2026">
      <p>{BRAND.name} is run by {BRAND.company}, {BRAND.address}. By creating an account or buying from our shop you agree to these terms.</p>
      <h2>The service</h2>
      <p>{BRAND.name} shows information you provide on TVs you pair. You're responsible for what you put on the screen and for having your guests' permission to show their first name.</p>
      <h2>Plans</h2>
      <p>The Free plan includes 1 TV and 1 property. Pro is KES 499 per TV a month, paid ahead monthly or yearly (yearly includes 2 months free). We never charge you automatically: when your paid time ends you choose whether to pay again. If Pro lapses, calendar sync pauses and TVs beyond the Free limit show a renewal note instead of guest details.</p>
      <h2>Payments and refunds</h2>
      <p>You can pay by M-Pesa or card. Refunds, cancellations and shop returns are covered by our <Link to="/refunds" className="font-semibold text-green underline">Refund and cancellation policy</Link>.</p>
      <h2>Availability</h2>
      <p>We work hard to keep the service running. TVs keep showing the last screen when the internet drops, but we can't promise uninterrupted service.</p>
      <h2>Ending your account</h2>
      <p>You can delete your account at any time in Settings. We may suspend accounts that misuse the service.</p>
      <h2>Contact</h2>
      <p>{BRAND.company}, {BRAND.address}. Email {BRAND.email} or WhatsApp {BRAND.supportWhatsApp}.</p>
    </LegalPage>
  );
}

export function Refunds() {
  return (
    <LegalPage title="Refund and cancellation policy" updated="14 November 2026">
      <p>This policy covers Karibu TV Pro and devices bought from the Karibu TV Shop. {BRAND.name} is a product of {BRAND.company}, {BRAND.address}.</p>

      <h2>Karibu TV Pro</h2>
      <ul>
        <li><b>Free trial.</b> New accounts get 30 days of Pro free. No card or payment is needed, so there's nothing to cancel or refund.</li>
        <li><b>No automatic charges.</b> You pay ahead for a month or a year. We never charge you again without you choosing to pay, so you can stop at any time simply by not renewing.</li>
        <li><b>Monthly payments</b> are not refundable once the month has started.</li>
        <li><b>Yearly payments</b> can be refunded in full if you ask within 7 days of paying. After that, they are not refundable for the unused months.</li>
        <li><b>Charged by mistake?</b> If you were charged twice or charged the wrong amount, we refund the extra in full.</li>
        <li><b>If we let you down.</b> If Karibu TV is unavailable for more than 72 hours in a row because of a problem on our side, we add the lost days to your Pro time.</li>
        <li>When Pro ends, your account moves to the Free plan. Your properties and settings stay; nothing is deleted.</li>
      </ul>

      <h2>Shop orders</h2>
      <ul>
        <li><b>Cancelling an order.</b> You can cancel any time before it is dispatched for a full refund.</li>
        <li><b>Returns.</b> You can return a device within <b>5 business days</b> of delivery if it is <b>unopened</b>, with its seal and original packaging intact. We refund the price of the device. Delivery fees are not refunded, and you cover the cost of sending it back (or we collect it in Nairobi for the delivery fee of your area).</li>
        <li><b>Opened devices</b> can't be returned unless they are faulty.</li>
        <li><b>Faulty or damaged on arrival.</b> Tell us within 5 business days of delivery, opened or not, and we'll replace it or refund you in full, including delivery.</li>
        <li><b>Setup visits</b> are refundable if cancelled before the visit. Once the visit has happened, the setup fee is not refundable.</li>
        <li>After 5 business days, devices are covered by the manufacturer's warranty and we're happy to help you claim it.</li>
      </ul>

      <h2>How to ask for a refund or return</h2>
      <p>WhatsApp us on {BRAND.supportWhatsApp} or email {BRAND.email} with your account email or order number and the reason. We reply within 1 business day.</p>

      <h2>How refunds are paid</h2>
      <p>We refund to the way you paid: M-Pesa refunds usually arrive within 3 business days, card refunds within 5 to 10 business days depending on your bank. We'll confirm by email when the refund is sent.</p>
    </LegalPage>
  );
}
