import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

/** Service-role client (bypasses RLS). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase. */
export const admin = (): SupabaseClient =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

/** The signed-in host making the call, or null. Cron calls use the service-role key instead. */
export async function caller(req: Request): Promise<{ userId: string | null; isService: boolean }> {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return { userId: null, isService: false };
  if (token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return { userId: null, isService: true };
  const { data } = await admin().auth.getUser(token);
  return { userId: data.user?.id ?? null, isService: false };
}

export async function isPro(db: SupabaseClient, userId: string) {
  const { data } = await db.rpc("plan_info", { uid: userId });
  return !!(data as { pro?: boolean } | null)?.pro;
}
