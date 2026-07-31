import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { type AppEnv, getEnv } from "@/lib/env";

export const ADMIN_ACCESS_DENIED_MESSAGE = "Esta cuenta no tiene acceso al panel de PÍLULA";

export function getAdminAllowedEmails(env: AppEnv = getEnv()) {
  return env.ADMIN_ALLOWED_EMAIL.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminAllowedEmail(email: string | null | undefined, env: AppEnv = getEnv()) {
  return Boolean(email && getAdminAllowedEmails(env).includes(email.toLowerCase()));
}

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
  if (error || !isAdminAllowedEmail(email, env)) {
    return { ok: false as const, error: "No autorizado" };
  }

  return { ok: true as const, email };
}
