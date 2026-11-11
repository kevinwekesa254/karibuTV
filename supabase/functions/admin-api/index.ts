// Super admin actions that need the service-role key. Every call must come from an admin whose
// session passed two-step verification (checked with public.admin_ok() using the caller's own token).
//   POST { action: "create_host", email, name, whatsapp?, country?, trial_days? }
//   POST { action: "send_reset", user_id }
//   POST { action: "resend_invite", user_id }
//   POST { action: "set_active", user_id, active }
//   POST { action: "delete_host", user_id, confirm_email }
//   POST { action: "invite_admin", email, name, admin_role }
//   POST { action: "set_admin_role", user_id, admin_role }   (null removes admin access)
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { admin, cors, json } from "../_shared/supabase.ts";

const HOST_APP = Deno.env.get("HOST_APP_URL") || "https://tv.mrserengeti.com";
const ADMIN_APP = Deno.env.get("ADMIN_APP_URL") || "https://admintv.mrserengeti.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ["owner", "support", "sales", "ops"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const auth = req.headers.get("Authorization") || "";
  if (!auth) return json({ error: "Sign in first." }, 401);

  // Check admin + 2-step with the caller's own token (RLS-aware client).
  const asCaller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false },
  });
  const { data: me } = await asCaller.auth.getUser();
  const { data: okAdmin } = await asCaller.rpc("admin_ok");
  if (!me?.user || okAdmin !== true) return json({ error: "Admins only, with two-step verification." }, 403);

  const db = admin();
  const { data: myProfile } = await db.from("profiles").select("admin_role").eq("id", me.user.id).single();
  const isOwner = myProfile?.admin_role === "owner";
  const body = await req.json().catch(() => ({}));
  const audit = (action: string, target: string, detail: Record<string, unknown> = {}) =>
    db.from("audit_log").insert({ actor: me.user!.id, action, target, detail });
  const userEmail = async (id: string) => (await db.auth.admin.getUserById(id)).data.user?.email || "";

  try {
    switch (body.action) {
      case "create_host": {
        const email = String(body.email || "").trim().toLowerCase();
        if (!EMAIL_RE.test(email)) return json({ error: "Enter a valid email." }, 400);
        const { data, error } = await db.auth.admin.inviteUserByEmail(email, {
          data: { name: String(body.name || "").slice(0, 80), whatsapp: String(body.whatsapp || "").slice(0, 20), country: body.country || "KE" },
          redirectTo: `${HOST_APP}/reset/new`,
        });
        if (error) return json({ error: error.message.includes("already") ? "That email already has an account." : error.message }, 400);
        const days = Math.max(0, Math.min(365, Number(body.trial_days ?? 30)));
        await db.from("profiles").update({ plan: days ? "pro" : "free", trial: days > 0, plan_until: days ? new Date(Date.now() + days * 864e5).toISOString() : null }).eq("id", data.user.id);
        await audit("create_host", data.user.id, { email, trial_days: days });
        return json({ ok: true, user_id: data.user.id });
      }
      case "send_reset": {
        const email = await userEmail(body.user_id);
        if (!email) return json({ error: "User not found." }, 404);
        const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: `${HOST_APP}/reset/new` });
        if (error) return json({ error: error.message }, 400);
        await audit("send_reset", body.user_id, { email });
        return json({ ok: true });
      }
      case "resend_invite": {
        const email = await userEmail(body.user_id);
        if (!email) return json({ error: "User not found." }, 404);
        const { error } = await db.auth.admin.inviteUserByEmail(email, { redirectTo: `${HOST_APP}/reset/new` });
        if (error) return json({ error: error.message.includes("already") ? "They've already accepted. Send a password reset instead." : error.message }, 400);
        await audit("resend_invite", body.user_id, { email });
        return json({ ok: true });
      }
      case "set_active": {
        if (body.user_id === me.user.id) return json({ error: "You can't pause your own account." }, 400);
        const active = !!body.active;
        const { error } = await db.auth.admin.updateUserById(body.user_id, { ban_duration: active ? "none" : "876000h" });
        if (error) return json({ error: error.message }, 400);
        await db.from("profiles").update({ active }).eq("id", body.user_id);
        await audit(active ? "activate_host" : "deactivate_host", body.user_id);
        return json({ ok: true });
      }
      case "delete_host": {
        if (!isOwner) return json({ error: "Only the owner can delete accounts." }, 403);
        const email = await userEmail(body.user_id);
        if (!email || email !== String(body.confirm_email || "").trim().toLowerCase()) return json({ error: "Type the host's email exactly to confirm." }, 400);
        if (body.user_id === me.user.id) return json({ error: "You can't delete yourself." }, 400);
        const { data: devs } = await db.from("devices").select("id").eq("owner_id", body.user_id);
        for (const d of devs || []) await db.from("devices").update({ property_id: null, owner_id: null, secret_hash: null }).eq("id", d.id);
        const { error } = await db.auth.admin.deleteUser(body.user_id);
        if (error) return json({ error: error.message }, 400);
        await audit("delete_host", body.user_id, { email });
        return json({ ok: true });
      }
      case "invite_admin": {
        if (!isOwner) return json({ error: "Only the owner can add team members." }, 403);
        const email = String(body.email || "").trim().toLowerCase();
        if (!EMAIL_RE.test(email) || !ROLES.includes(body.admin_role)) return json({ error: "Enter an email and a role." }, 400);
        let userId: string | undefined;
        const { data, error } = await db.auth.admin.inviteUserByEmail(email, { data: { name: String(body.name || "").slice(0, 80) }, redirectTo: `${ADMIN_APP}/set-password` });
        if (error && !error.message.includes("already")) return json({ error: error.message }, 400);
        userId = data?.user?.id;
        if (!userId) {
          const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
          userId = list.users.find((u) => u.email === email)?.id;
        }
        if (!userId) return json({ error: "Couldn't find or create that user." }, 400);
        await db.from("profiles").update({ role: "admin", admin_role: body.admin_role, plan: "free", trial: false }).eq("id", userId);
        await audit("invite_admin", userId, { email, admin_role: body.admin_role });
        return json({ ok: true, user_id: userId });
      }
      case "set_admin_role": {
        if (!isOwner) return json({ error: "Only the owner can change roles." }, 403);
        if (body.user_id === me.user.id) return json({ error: "You can't change your own role." }, 400);
        const role = body.admin_role === null ? null : String(body.admin_role);
        if (role !== null && !ROLES.includes(role)) return json({ error: "Unknown role." }, 400);
        await db.from("profiles").update(role ? { role: "admin", admin_role: role } : { role: "host", admin_role: null }).eq("id", body.user_id);
        await audit("set_admin_role", body.user_id, { admin_role: role });
        return json({ ok: true });
      }
      default:
        return json({ error: "Unknown action." }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error).message || "Something went wrong." }, 500);
  }
});
