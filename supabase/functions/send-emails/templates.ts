// Karibu TV email templates. Plain tables and inline styles so they render in Gmail, Outlook and phones.
// Every value from users or the database goes through esc().

export interface Ctx {
  hostApp: string; // https://tv.mrserengeti.com
  adminApp: string; // https://admintv.mrserengeti.com
  name: string; // recipient's name ("" if unknown)
  data: Record<string, unknown>;
  profile?: { plan_until: string | null; pro_tvs: number; email_token: string; trial: boolean } | null;
  shop?: { mpesa_till?: string; mpesa_name?: string; whatsapp?: string } | null;
  kind: "account" | "reminder" | "marketing" | "team";
}
export interface Rendered { subject: string; html: string; text: string; unsubscribe?: string }

const MAROON = "#7a1a2e", NAVY = "#17182a", GOLD = "#d9a441", INK = "#1d1e2c", MUTED = "#5d6070", LINE = "#e6e3df", WASH = "#f6f4f1";
const WHATSAPP = "+254711855263";

export const esc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const first = (name: string) => (name || "").trim().split(/\s+/)[0] || "there";
const kes = (n: unknown) => `KES ${Math.round(Number(n) || 0).toLocaleString("en-KE")}`;
const day = (iso: unknown) =>
  iso ? new Date(String(iso)).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Nairobi" }) : "";
const when = (iso: unknown) =>
  iso ? new Date(String(iso)).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" }) + " (Nairobi time)" : "";
const multiline = (s: unknown) => esc(s).replace(/\n/g, "<br>");

const p = (html: string) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${INK}">${html}</p>`;
const small = (html: string) => `<p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:${MUTED}">${html}</p>`;
const h1 = (html: string) => `<h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;color:${NAVY};font-weight:700">${html}</h1>`;
const button = (href: string, label: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="border-radius:999px;background:${MAROON}">
  <a href="${esc(href)}" style="display:inline-block;padding:14px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px">${esc(label)}</a></td></tr></table>`;
const quote = (html: string) =>
  `<div style="margin:0 0 20px;padding:14px 16px;border-left:4px solid ${MAROON};background:${WASH};border-radius:6px;font-size:15px;line-height:1.6;color:${INK}">${html}</div>`;
const rows = (pairs: [string, string][]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:collapse;font-size:15px">${pairs
    .map(([k, v], i) => `<tr><td style="padding:10px 0;color:${MUTED};${i ? `border-top:1px solid ${LINE};` : ""}">${k}</td><td align="right" style="padding:10px 0;color:${INK};font-weight:600;${i ? `border-top:1px solid ${LINE};` : ""}">${v}</td></tr>`)
    .join("")}</table>`;
const steps = (items: string[]) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px">${items
    .map((s, i) => `<tr><td valign="top" style="padding:0 12px 12px 0"><div style="width:26px;height:26px;border-radius:13px;background:${MAROON};color:#fff;font-size:13px;font-weight:700;line-height:26px;text-align:center">${i + 1}</div></td><td style="padding:3px 0 12px;font-size:15px;line-height:1.5;color:${INK}">${s}</td></tr>`)
    .join("")}</table>`;

const kitenge = () => {
  const c = [MAROON, NAVY, GOLD, NAVY, MAROON, GOLD, NAVY, MAROON, NAVY, GOLD, MAROON, NAVY];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${c.map((x) => `<td height="6" style="height:6px;line-height:6px;font-size:0;background:${x}">&nbsp;</td>`).join("")}</tr></table>`;
};

function layout(c: Ctx, preheader: string, body: string, unsubscribe?: string) {
  const footerWhy = c.kind === "team"
    ? "Team alert from Karibu TV."
    : c.kind === "reminder"
      ? `You get reminders because you have a Karibu TV account.${unsubscribe ? ` <a href="${esc(unsubscribe)}" style="color:${MUTED}">Turn off reminders</a>.` : ""}`
      : c.kind === "marketing"
        ? `You asked for tips and offers from Karibu TV.${unsubscribe ? ` <a href="${esc(unsubscribe)}" style="color:${MUTED}">Unsubscribe</a>.` : ""}`
        : "You get this email because of your Karibu TV account or order.";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Karibu TV</title></head>
<body style="margin:0;padding:0;background:${WASH};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${WASH}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${LINE};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<tr><td style="background:${NAVY};padding:20px 28px"><a href="${esc(c.hostApp)}" style="text-decoration:none;font-size:20px;font-weight:800;letter-spacing:-0.3px;color:#ffffff">Karibu<span style="color:${GOLD}">&nbsp;TV</span></a></td></tr>
<tr><td>${kitenge()}</td></tr>
<tr><td style="padding:32px 28px 12px">${body}</td></tr>
<tr><td style="padding:20px 28px 28px;border-top:1px solid ${LINE}">
${small(`Questions? Reply to this email or WhatsApp us on <a href="https://wa.me/${WHATSAPP.replace(/\D/g, "")}" style="color:${MAROON}">${WHATSAPP}</a>.`)}
${small(footerWhy)}
${small("Karibu TV by Mr Serengeti · Nairobi, Kenya")}
</td></tr></table></td></tr></table></body></html>`;
}

const toText = (html: string) =>
  html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<div style="display:none[\s\S]*?<\/div>/, "")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, "$2 ($1)").replace(/<br\s*\/?>/g, "\n").replace(/<\/(p|h1|tr|div)>/g, "\n")
    .replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

type Build = (c: Ctx) => { subject: string; preheader: string; body: string };

const orderItems = (d: Record<string, unknown>) => {
  const items = (d.items as { name: string; qty: number; price_kes: number }[]) || [];
  return rows([
    ...items.map((i) => [`${esc(i.qty)} × ${esc(i.name)}`, kes(i.price_kes * i.qty)] as [string, string]),
    ["Delivery", kes(d.delivery_kes)],
    ...(Number(d.setup_kes) > 0 ? [["Setup visit", kes(d.setup_kes)] as [string, string]] : []),
    ["<b>Total</b>", `<b>${kes(d.total_kes)}</b>`],
  ]);
};
const orderLink = (c: Ctx) => `${c.hostApp}/shop/order/${c.data.number}?t=${c.data.token}`;

const T: Record<string, Build> = {
  welcome: (c) => ({
    subject: "Karibu! Your TV welcome screen is 3 steps away",
    preheader: "Add your place, pair your TV and greet your next guest by name.",
    body: h1(`Karibu, ${esc(first(c.name))}!`) +
      p("Thanks for joining Karibu TV. In about 10 minutes your guests will see their name, your Wi-Fi and your house rules the moment they switch on the TV.") +
      steps([
        "<b>Add your property</b>: name, Wi-Fi, check-in times and house rules.",
        `<b>Pair your TV</b>: on an Android or Google TV, install the Karibu TV app from <a href="${esc(c.hostApp)}/tv.apk" style="color:${MAROON}">tv.mrserengeti.com/tv.apk</a> and type the code it shows.`,
        "<b>Add your next guest</b> (or connect your Airbnb calendar) and their name appears on screen.",
      ]) +
      (c.profile?.trial && c.profile.plan_until ? p(`Your <b>Pro trial is free until ${esc(day(c.profile.plan_until))}</b>. No card needed.`) : "") +
      button(`${c.hostApp}/app`, "Open my dashboard") +
      small(`No smart TV? We sell and set up TV sticks: <a href="${esc(c.hostApp)}/shop" style="color:${MAROON}">see the shop</a>.`),
  }),
  trial_ending: (c) => ({
    subject: "Your Karibu TV trial ends in 3 days",
    preheader: "Keep every TV welcoming guests: Pro is KES 399 per TV for your first 3 months.",
    body: h1("Your free trial ends in 3 days") +
      p(`Hi ${esc(first(c.name))}, your Pro trial ends on <b>${esc(day(c.data.plan_until))}</b>. After that your account moves to the Free plan: 1 property and 1 TV.`) +
      p("To keep all your TVs, custom logo, weather and calendar sync, upgrade to Pro. It's <b>KES 399 per TV a month for the first 3 months</b>, then KES 499, with 15% off from 5 TVs. Pay by M-Pesa.") +
      button(`${c.hostApp}/app/billing`, "Upgrade to Pro"),
  }),
  trial_ended: (c) => ({
    subject: "Your Karibu TV trial has ended",
    preheader: "You're on the Free plan now. Upgrade any time to bring back every TV.",
    body: h1("Your trial has ended") +
      p(`Hi ${esc(first(c.name))}, thanks for trying Karibu TV Pro. Your account is now on the <b>Free plan</b>: your first property and 1 TV keep working.`) +
      p("Upgrade to Pro to turn your other TVs back on. Everything you set up is still saved.") +
      button(`${c.hostApp}/app/billing`, "See Pro plans"),
  }),
  renew_reminder: (c) => ({
    subject: Number(c.data.days) <= 1 ? "Your Karibu TV Pro plan ends tomorrow" : "Your Karibu TV Pro plan renews in 7 days",
    preheader: `Paid until ${day(c.data.plan_until)}. Pay by M-Pesa to keep your TVs on.`,
    body: h1(Number(c.data.days) <= 1 ? "Your Pro plan ends tomorrow" : "Your Pro plan renews next week") +
      p(`Hi ${esc(first(c.name))}, your Pro plan is paid until <b>${esc(day(c.data.plan_until))}</b>.`) +
      p("To keep every TV welcoming guests without a break, pay for your next month before then. It only takes a minute with M-Pesa.") +
      button(`${c.hostApp}/app/billing`, "Pay now"),
  }),
  plan_expired: (c) => ({
    subject: "Your Karibu TV Pro plan has ended",
    preheader: "Your extra TVs are paused. Renew to switch them back on.",
    body: h1("Your Pro plan has ended") +
      p(`Hi ${esc(first(c.name))}, your Pro plan ended on ${esc(day(c.data.plan_until))}. Your first property and 1 TV still work on the Free plan; the rest are paused.`) +
      p("Renew any time. Everything you set up is saved and comes straight back.") +
      button(`${c.hostApp}/app/billing`, "Renew Pro"),
  }),
  payment_receipt: (c) => ({
    subject: `Receipt: ${String(c.data.currency)} ${Number(c.data.amount).toLocaleString("en-KE")} for Karibu TV Pro`,
    preheader: "Thank you. Your Pro plan has been extended.",
    body: h1("Thank you, payment received") +
      p(`Hi ${esc(first(c.name))}, here's your receipt.`) +
      rows([
        ["Amount", `${esc(c.data.currency)} ${esc(Number(c.data.amount).toLocaleString("en-KE"))}`],
        ["For", `${esc(c.data.tvs)} TV${Number(c.data.tvs) === 1 ? "" : "s"} × ${esc(c.data.months)} month${Number(c.data.months) === 1 ? "" : "s"}`],
        ...(c.data.coupon ? [["Coupon", esc(c.data.coupon)] as [string, string]] : []),
        ["Paid with", c.data.provider === "mpesa" ? "M-Pesa" : "Card"],
        ["Reference", esc(c.data.reference || "-")],
        ["Date", esc(day(c.data.paid_at))],
        ...(c.profile?.plan_until ? [["Pro paid until", `<b>${esc(day(c.profile.plan_until))}</b>`] as [string, string]] : []),
      ]) +
      button(`${c.hostApp}/app/billing`, "View billing"),
  }),
  ticket_reply: (c) => ({
    subject: `Re: ${String(c.data.subject)} [#${c.data.number}]`,
    preheader: String(c.data.body || "").slice(0, 110),
    body: h1(`We replied to ticket #${esc(c.data.number)}`) +
      p(`Hi ${esc(first(c.name))}, our support team replied about <b>${esc(c.data.subject)}</b>:`) +
      quote(multiline(c.data.body)) +
      button(`${c.hostApp}/app/support/${c.data.ticket_id}`, "Reply in Karibu TV") +
      small("Please reply in the app so the whole team can see the conversation."),
  }),
  ticket_solved: (c) => ({
    subject: `Solved: ${String(c.data.subject)} [#${c.data.number}]`,
    preheader: "Tell us how we did. It takes one tap.",
    body: h1(`Ticket #${esc(c.data.number)} is solved`) +
      p(`Hi ${esc(first(c.name))}, we've marked <b>${esc(c.data.subject)}</b> as solved. If anything still isn't right, open the ticket and reply, and it reopens.`) +
      p("How did we do? Rate us from 1 to 5 on the ticket.") +
      button(`${c.hostApp}/app/support/${c.data.ticket_id}`, "Rate our help"),
  }),
  tv_offline: (c) => ({
    subject: `${String(c.data.device)} has been offline for a day`,
    preheader: "Usually a power cut or the TV is on another input. Here's a quick check.",
    body: h1(`${esc(c.data.device)} is offline`) +
      p(`Hi ${esc(first(c.name))}, the TV <b>${esc(c.data.device)}</b>${c.data.property ? ` at <b>${esc(c.data.property)}</b>` : ""} last checked in on ${esc(when(c.data.last_seen))}.`) +
      steps([
        "Check the TV and the plug have power (power cuts are the most common cause).",
        "Press <b>Home</b> on the remote and open <b>Karibu TV</b>, or switch the input back to it.",
        "Make sure the TV is still on the property's Wi-Fi.",
      ]) +
      button(`${c.hostApp}/app/tvs`, "See my TVs") +
      small("It's fine to ignore this if the TV is switched off on purpose."),
  }),
  order_confirmed: (c) => ({
    subject: `Order #${c.data.number} confirmed: Karibu TV shop`,
    preheader: c.data.payment_method === "mpesa_till" ? "Pay by M-Pesa to get your order on its way." : "We'll call you to arrange delivery.",
    body: h1(`Asante, ${esc(first(c.name))}! Order #${esc(c.data.number)} is in`) +
      orderItems(c.data) +
      (c.data.payment_method === "mpesa_till" && c.shop?.mpesa_till
        ? quote(`<b>Pay by M-Pesa</b><br>Lipa na M-Pesa → Buy Goods → Till <b>${esc(c.shop.mpesa_till)}</b>${c.shop.mpesa_name ? ` (${esc(c.shop.mpesa_name)})` : ""}<br>Amount: <b>${kes(c.data.total_kes)}</b>. We confirm as soon as it arrives.`)
        : c.data.payment_method === "cod" ? p("You'll pay when we deliver, by M-Pesa or cash.") : p("We'll confirm the details with you on WhatsApp.")) +
      p(`<b>${c.data.fulfilment === "delivery_setup" ? "Delivery and setup visit" : "Delivery"}:</b> ${esc(c.data.zone_name)}<br>${esc(c.data.address)}`) +
      button(orderLink(c), "Track my order"),
  }),
  order_paid: (c) => ({
    subject: `Payment received for order #${c.data.number}`,
    preheader: "We're packing your order now.",
    body: h1("Payment received") + p(`Hi ${esc(first(c.name))}, thanks! We've received payment for order #${esc(c.data.number)} and we're getting it ready.`) + button(orderLink(c), "Track my order"),
  }),
  order_dispatched: (c) => ({
    subject: `Order #${c.data.number} is on its way`,
    preheader: "Our rider will call you before arriving.",
    body: h1("Your order is on its way") +
      p(`Hi ${esc(first(c.name))}, order #${esc(c.data.number)} has left us. Our rider will call ${esc(c.data.phone)} before arriving.`) +
      (c.data.fulfilment === "delivery_setup" ? p("We'll set up the stick on your TV and pair it with Karibu TV while we're there.") : "") +
      button(orderLink(c), "Track my order"),
  }),
  order_delivered: (c) => ({
    subject: `Order #${c.data.number} delivered`,
    preheader: "Enjoy! Here's how to get Karibu TV on it.",
    body: h1("Delivered. Enjoy!") +
      p(`Hi ${esc(first(c.name))}, order #${esc(c.data.number)} has been delivered.`) +
      p(`Using it in a rental? Turn it into a guest welcome screen with Karibu TV. <b>Free for 30 days.</b>`) +
      button(`${c.hostApp}/signup`, "Try Karibu TV free"),
  }),
  order_cancelled: (c) => ({
    subject: `Order #${c.data.number} cancelled`,
    preheader: "If this is a mistake, just reply.",
    body: h1("Your order was cancelled") +
      p(`Hi ${esc(first(c.name))}, order #${esc(c.data.number)} has been cancelled. If you paid, we'll refund you by M-Pesa. If this is a mistake, reply to this email or WhatsApp us.`),
  }),
  team_new_ticket: (c) => ({
    subject: `[Ticket #${c.data.number}] ${String(c.data.subject)}${c.data.priority === "urgent" || c.data.priority === "high" ? ` (${c.data.priority})` : ""}`,
    preheader: `${c.data.host_name || c.data.host_email}: ${String(c.data.body || "").slice(0, 90)}`,
    body: h1(`New ticket #${esc(c.data.number)}`) +
      rows([["From", `${esc(c.data.host_name || "")} &lt;${esc(c.data.host_email)}&gt;`], ["Category", esc(c.data.category)], ["Priority", esc(c.data.priority)]]) +
      p(`<b>${esc(c.data.subject)}</b>`) + quote(multiline(c.data.body)) +
      button(`${c.adminApp}/tickets/${c.data.ticket_id}`, "Open in admin"),
  }),
  team_ticket_reply: (c) => ({
    subject: `[Ticket #${c.data.number}] Host replied: ${String(c.data.subject)}`,
    preheader: String(c.data.body || "").slice(0, 110),
    body: h1(`${esc(c.data.host_name || "The host")} replied on #${esc(c.data.number)}`) + quote(multiline(c.data.body)) +
      button(`${c.adminApp}/tickets/${c.data.ticket_id}`, "Open in admin"),
  }),
  team_new_order: (c) => ({
    subject: `[Order #${c.data.number}] ${kes(c.data.total_kes)} from ${String(c.data.name)}`,
    preheader: `${c.data.zone_name} · ${c.data.payment_method}`,
    body: h1(`New shop order #${esc(c.data.number)}`) + orderItems(c.data) +
      rows([["Customer", `${esc(c.data.name)} · ${esc(c.data.phone)}`], ["Where", `${esc(c.data.zone_name)}: ${esc(c.data.address)}`],
        ["Payment", esc({ mpesa_till: "M-Pesa till", cod: "Pay on delivery", whatsapp: "WhatsApp" }[String(c.data.payment_method)] || c.data.payment_method)],
        ["Setup visit", c.data.fulfilment === "delivery_setup" ? "Yes" : "No"]]) +
      (c.data.note ? quote(multiline(c.data.note)) : "") +
      button(`${c.adminApp}/orders?open=${c.data.order_id}`, "Open in admin"),
  }),
  team_new_lead: (c) => ({
    subject: `New lead: ${String(c.data.name)}${Number(c.data.tv_count) ? ` (${c.data.tv_count} TVs)` : ""}`,
    preheader: `${c.data.city || ""} ${c.data.country || ""}`.trim(),
    body: h1("New lead from the website") +
      rows([["Name", esc(c.data.name)], ["Email", esc(c.data.email || "-")], ["WhatsApp", esc(c.data.whatsapp || "-")],
        ["Where", esc([c.data.city, c.data.country].filter(Boolean).join(", ") || "-")], ["TVs", `${esc(c.data.tv_count || "-")} ${esc(c.data.tv_brand || "")}`]]) +
      (c.data.message ? quote(multiline(c.data.message)) : "") +
      button(`${c.adminApp}/pipeline`, "Open pipeline"),
  }),
  test: (c) => ({
    subject: "Test email from Karibu TV",
    preheader: "If you can read this, Brevo sending works.",
    body: h1("It works!") + p("This is a test email from the Karibu TV admin. Sending through Brevo is set up correctly.") + small(`Sent ${esc(when(new Date().toISOString()))}.`),
  }),
};

export function render(template: string, c: Ctx): Rendered | null {
  const t = T[template];
  if (!t) return null;
  const unsubscribe = c.profile?.email_token && (c.kind === "reminder" || c.kind === "marketing")
    ? `${c.hostApp}/unsubscribe?t=${c.profile.email_token}&k=${c.kind === "reminder" ? "reminders" : "marketing"}` : undefined;
  const b = t(c);
  const html = layout(c, b.preheader, b.body, unsubscribe);
  return { subject: b.subject, html, text: toText(b.body) + "\n\n--\nKaribu TV by Mr Serengeti · Nairobi, Kenya" + (unsubscribe ? `\nTurn these off: ${unsubscribe}` : ""), unsubscribe };
}
export const TEMPLATES = Object.keys(T);
