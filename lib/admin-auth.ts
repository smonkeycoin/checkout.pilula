import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { getEnv } from "@/lib/env";

export const ADMIN_ALLOWLIST = ["pilulamedplanner@gmail.com"];

export async function verifyAdminRequest(request: NextRequest) {
  const env = getEnv();
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !env.SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { ok: false as const, error: "No autorizado" };
  }

  const supabase = createClient(env.SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data, error } = await supabase.auth.getUser(token);
  const email = data.user?.email?.toLowerCase();
  if (error || !email || !ADMIN_ALLOWLIST.includes(email)) {
    return { ok: false as const, error: "No autorizado" };
  }

  return { ok: true as const, email };
}
