import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { type AppEnv, getEnv } from "@/lib/env";

export const ADMIN_ACCESS_DENIED_MESSAGE = "Esta cuenta no tiene acceso al panel de PILULA";

export function getAdminAllowedEmails(env: AppEnv = getEnv()) {
  return env.ADMIN_ALLOWED_EMAIL.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminAllowedEmail(email: string | null | undefined, env: AppEnv = getEnv()) {
  return Boolean(email && getAdminAllowedEmails(env).includes(email.toLowerCase()));
}

export type AdminAuthFailureReason = "missing_token" | "invalid_token" | "email_not_allowed";

function logAdminUnauthorized(request: NextRequest, reason: AdminAuthFailureReason) {
  console.warn("[admin_auth]", {
    route: request.nextUrl.pathname,
    reason
  });
}

export async function verifyAdminRequest(request: NextRequest) {
  const env = getEnv();
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !env.SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const reason = "missing_token" as const;
    logAdminUnauthorized(request, reason);
    return { ok: false as const, error: "No autorizado", reason };
  }

  const supabase = createClient(env.SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data, error } = await supabase.auth.getUser(token);
  const email = data.user?.email?.toLowerCase();
  if (error) {
    const reason = "invalid_token" as const;
    logAdminUnauthorized(request, reason);
    return { ok: false as const, error: "No autorizado", reason };
  }
  if (!isAdminAllowedEmail(email, env)) {
    const reason = "email_not_allowed" as const;
    logAdminUnauthorized(request, reason);
    return { ok: false as const, error: "No autorizado", reason };
  }

  return { ok: true as const, email };
}

export function adminUnauthorizedBody(reason: AdminAuthFailureReason) {
  return { error: "No autorizado", reason };
}
