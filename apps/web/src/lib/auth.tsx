import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Profile } from "./types";

export interface Plan { pro: boolean; trial: boolean; maxTvs: number; maxProperties: number; until: string | null; daysLeft: number }

export function planOf(p: Profile | null): Plan {
  const until = p?.plan_until ? Date.parse(p.plan_until) : 0;
  const pro = !!p && p.plan === "pro" && until > Date.now();
  return {
    pro, trial: pro && !!p?.trial,
    maxTvs: pro ? Math.max(1, p!.pro_tvs || 1) : 1,
    maxProperties: pro ? 50 : 1,
    until: p?.plan_until || null,
    daysLeft: pro ? Math.max(0, Math.ceil((until - Date.now()) / 86400000)) : 0,
  };
}

interface AuthCtx {
  ready: boolean;
  user: User | null;
  profile: Profile | null;
  plan: Plan;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = useCallback(async (uid: string | undefined) => {
    if (!uid) { setProfile(null); return; }
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    setProfile((data as Profile) || null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setUser(data.session?.user ?? null);
      await loadProfile(data.session?.user.id).catch(() => {});
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      loadProfile(session?.user.id).catch(() => {});
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const value = useMemo<AuthCtx>(() => ({
    ready, user, profile, plan: planOf(profile),
    refreshProfile: () => loadProfile(user?.id),
    signOut: async () => { await supabase.auth.signOut(); },
  }), [ready, user, profile, loadProfile]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
