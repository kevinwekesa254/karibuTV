import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase, errorMessage } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { timeAgo } from "@/lib/dates";
import { resizeImage } from "@/lib/image";
import { BRAND, waLink } from "@/lib/brand";
import { Icon, WhatsAppIcon } from "@/components/Icons";
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, PageLoader, Select, Spinner, Textarea } from "@/components/ui";
import { useData } from "./data";

export interface Ticket {
  id: string; number: number; subject: string; category: string; priority: string;
  status: "open" | "pending" | "resolved" | "closed"; rating: number | null; property_id: string | null; device_id: string | null;
  last_author: "host" | "admin"; last_message_at: string; created_at: string;
}
interface Message { id: string; author_role: "host" | "admin"; body: string; attachment: string; created_at: string }

export const CATEGORIES: { key: string; label: string; icon: string }[] = [
  { key: "tv", label: "TV or app", icon: "tv" },
  { key: "setup", label: "Setup help", icon: "bolt" },
  { key: "billing", label: "Billing and plans", icon: "card" },
  { key: "account", label: "My account", icon: "user" },
  { key: "shop", label: "Shop order", icon: "download" },
  { key: "feature", label: "Feature idea", icon: "sparkle" },
  { key: "other", label: "Something else", icon: "help" },
];

const STATUS: Record<Ticket["status"], { label: string; className: string }> = {
  open: { label: "Waiting for us", className: "bg-[#fff4e5] text-[#9a4a00]" },
  pending: { label: "Waiting for you", className: "bg-mint text-maroon" },
  resolved: { label: "Resolved", className: "bg-[#e7f6ec] text-[#1a7f43]" },
  closed: { label: "Closed", className: "bg-line text-ink-muted" },
};
export const StatusPill = ({ s }: { s: Ticket["status"] }) => <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[s].className}`}>{STATUS[s].label}</span>;

async function uploadShot(userId: string, file: File) {
  const small = await resizeImage(file, 1600, 0.8);
  const path = `${userId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("support-files").upload(path, small, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return path;
}

function Shot({ path }: { path: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => { supabase.storage.from("support-files").createSignedUrl(path, 3600).then(({ data }) => setUrl(data?.signedUrl || "")); }, [path]);
  return url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Attached screenshot" className="mt-2 max-h-56 rounded-md border border-line" /></a> : <Spinner size={16} />;
}

function NewTicket({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { properties, devices } = useData();
  const toast = useToast();
  const nav = useNavigate();
  const [f, setF] = useState({ category: "tv", subject: "", body: "", property_id: properties[0]?.id || "", device_id: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || f.subject.trim().length < 3 || f.body.trim().length < 3) return;
    setBusy(true);
    try {
      const attachment = file ? await uploadShot(user.id, file) : "";
      const { data: t, error } = await supabase.from("tickets").insert({
        subject: f.subject.trim(), category: f.category, property_id: f.property_id || null, device_id: f.device_id || null,
      }).select("id").single();
      if (error) throw error;
      const { error: e2 } = await supabase.from("ticket_messages").insert({ ticket_id: t.id, body: f.body.trim(), attachment });
      if (e2) throw e2;
      toast("Ticket sent. We usually reply within a few hours.");
      onClose(); nav(`/app/support/${t.id}`);
    } catch (err) { toast(errorMessage(err), "error"); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Contact support" wide
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="new-ticket" loading={busy} disabled={f.subject.trim().length < 3 || f.body.trim().length < 3}>Send to support</Button></>}>
      <form id="new-ticket" onSubmit={submit} className="space-y-4">
        <div>
          <p className="kb-label">What's it about?</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Category">
            {CATEGORIES.map((c) => (
              <button key={c.key} type="button" role="radio" aria-checked={f.category === c.key} onClick={() => setF({ ...f, category: c.key })}
                className={`flex items-center gap-2 rounded-md border-2 px-3 py-2.5 text-left text-sm font-semibold transition-colors ${f.category === c.key ? "border-maroon bg-mint-soft" : "border-line hover:border-line-strong"}`}>
                <Icon name={c.icon} size={16} className="text-maroon" />{c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Property" optional>{(id) => <Select id={id} value={f.property_id} onChange={(e) => setF({ ...f, property_id: e.target.value })}><option value="">Not about a property</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>}</Field>
          <Field label="TV" optional>{(id) => <Select id={id} value={f.device_id} onChange={(e) => setF({ ...f, device_id: e.target.value })}><option value="">Not about a TV</option>{devices.filter((d) => d.property_id).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>}</Field>
        </div>
        <Field label="Subject">{(id) => <Input id={id} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} maxLength={120} placeholder="e.g. Bedroom TV shows a black screen" />}</Field>
        <Field label="Tell us what happened" hint="What you expected, what you saw, and since when.">{(id, d) => <Textarea id={id} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} rows={5} maxLength={5000} aria-describedby={d} />}</Field>
        <div className="flex flex-wrap items-center gap-3">
          <label className="kb-btn kb-btn--secondary kb-btn--sm cursor-pointer"><Icon name="image" size={15} />{file ? "Change photo" : "Add a photo or screenshot"}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          {file && <span className="text-sm text-ink-muted">{file.name}</span>}
        </div>
      </form>
    </Modal>
  );
}

export default function Support() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [open, setOpen] = useState(false);
  const { properties } = useData();
  useEffect(() => {
    const load = () => supabase.from("tickets").select("*").order("last_message_at", { ascending: false }).then(({ data }) => setTickets((data as Ticket[]) || []));
    load();
    const ch = supabase.channel("my-tickets").on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);
  return (
    <div>
      <PageHeader title={<span className="flex items-center gap-3"><Icon name="help" size={28} />Support</span>} subtitle="Ask us anything. Your conversations with the Karibu TV team live here."
        actions={<Button icon="plus" onClick={() => setOpen(true)}>New ticket</Button>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <Card className="overflow-hidden">
          {tickets === null ? <PageLoader /> : tickets.length ? (
            <ul className="divide-y divide-line">
              {tickets.map((t) => (
                <li key={t.id}>
                  <Link to={`/app/support/${t.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-wash">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mint-soft text-maroon"><Icon name={CATEGORIES.find((c) => c.key === t.category)?.icon || "help"} size={17} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{t.subject}</span>
                      <span className="block text-xs text-ink-muted">#{t.number} · {properties.find((p) => p.id === t.property_id)?.name || CATEGORIES.find((c) => c.key === t.category)?.label} · updated {timeAgo(t.last_message_at)}</span>
                    </span>
                    {t.last_author === "admin" && t.status === "pending" && <span className="h-2.5 w-2.5 rounded-full bg-maroon" aria-label="New reply" />}
                    <StatusPill s={t.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon="help" title="No tickets yet" body="Something not working, or a question about billing? Open a ticket and we'll reply here." action={<Button onClick={() => setOpen(true)}>Contact support</Button>} />}
        </Card>
        <Card className="h-fit p-5">
          <p className="font-display text-lg font-semibold text-forest">Need it fast?</p>
          <p className="mt-1 text-sm text-ink-muted">For a TV that's down right now, WhatsApp us as well.</p>
          <a className="kb-btn kb-btn--secondary kb-btn--sm mt-4 w-full" href={waLink(BRAND.supportWhatsApp, "Hi! I need urgent help with Karibu TV.")} target="_blank" rel="noreferrer"><WhatsAppIcon size={16} />WhatsApp support</a>
        </Card>
      </div>
      <NewTicket open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

export function TicketThread() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [t, setT] = useState<Ticket | null | undefined>(undefined);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    const [{ data: tt }, { data: mm }] = await Promise.all([
      supabase.from("tickets").select("*").eq("id", id).maybeSingle(),
      supabase.from("ticket_messages").select("id, author_role, body, attachment, created_at").eq("ticket_id", id).order("created_at"),
    ]);
    setT((tt as Ticket) || null); setMsgs((mm as Message[]) || []);
  }, [id]);
  useEffect(() => {
    load();
    const ch = supabase.channel(`ticket-${id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${id}` }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, load]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !reply.trim()) return;
    setBusy(true);
    try {
      const attachment = file ? await uploadShot(user.id, file) : "";
      const { error } = await supabase.from("ticket_messages").insert({ ticket_id: id, body: reply.trim(), attachment });
      if (error) throw error;
      setReply(""); setFile(null); await load();
    } catch (err) { toast(errorMessage(err), "error"); } finally { setBusy(false); }
  };
  const setStatus = async (status: Ticket["status"], rating?: number) => {
    const { error } = await supabase.from("tickets").update(rating ? { status, rating } : { status }).eq("id", id);
    if (error) toast(errorMessage(error), "error"); else { toast(rating ? "Thanks for the rating." : "Updated."); load(); }
  };

  if (t === undefined) return <PageLoader />;
  if (t === null) return <Card><EmptyState icon="help" title="Ticket not found" action={<Link to="/app/support" className="kb-btn kb-btn--secondary kb-btn--md">Back to support</Link>} /></Card>;
  const done = t.status === "resolved" || t.status === "closed";
  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/app/support" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-muted hover:text-ink"><Icon name="chevron-left" size={14} />All tickets</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-sm text-ink-muted">Ticket #{t.number}</p><h1 className="font-display text-2xl font-semibold text-forest">{t.subject}</h1></div>
        <StatusPill s={t.status} />
      </div>
      <div className="mt-6 space-y-4">
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.author_role === "host" ? "justify-end" : ""}`}>
            <div className={`max-w-[85%] rounded-lg px-4 py-3 ${m.author_role === "host" ? "bg-navy text-bone" : "border border-line bg-surface"}`}>
              <p className={`text-xs font-semibold ${m.author_role === "host" ? "text-bone/70" : "text-maroon"}`}>{m.author_role === "host" ? "You" : "Karibu TV support"} · {timeAgo(m.created_at)}</p>
              <p className="mt-1 whitespace-pre-wrap text-[0.9375rem]">{m.body}</p>
              {m.attachment && <Shot path={m.attachment} />}
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      {done ? (
        <Card className="mt-6 p-5 text-center">
          {t.rating ? <p className="text-sm text-ink-muted">You rated this {t.rating}/5. Thank you.</p> : (
            <>
              <p className="font-semibold">How did we do?</p>
              <div className="mt-3 flex justify-center gap-2">{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setStatus("closed", n)} className="flex h-11 w-11 items-center justify-center rounded-full border border-line font-display text-lg font-semibold hover:border-maroon hover:bg-mint-soft" aria-label={`${n} out of 5`}>{n}</button>)}</div>
            </>
          )}
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => setStatus("open")}>Reopen ticket</Button>
        </Card>
      ) : (
        <Card className="mt-6 p-4">
          <form onSubmit={send}>
            <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} maxLength={5000} placeholder="Write a reply…" aria-label="Reply" />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <label className="kb-btn kb-btn--ghost kb-btn--sm cursor-pointer"><Icon name="image" size={15} />{file ? file.name : "Attach photo"}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setStatus("resolved")}>Mark as solved</Button>
                <Button type="submit" size="sm" loading={busy} disabled={!reply.trim()}>Send</Button>
              </div>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
