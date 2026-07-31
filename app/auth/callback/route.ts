import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { isAdminAllowedEmail } from "@/lib/admin-auth";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

export async function GET(request: NextRequest) {
  const env = getEnv();
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next");
  const nextPath = next?.startsWith("/") ? next : "/admin";
  const loginErrorPath = `/admin/login?error=${encodeURIComponent("unauthorized")}`;

  let response = redirectTo(request, nextPath);

  if (!code || !env.SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return redirectTo(request, loginErrorPath);
  }

  const supabase = createServerClient(env.SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: false
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      }
    }
  });

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return redirectTo(request, loginErrorPath);
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !isAdminAllowedEmail(user?.email, env)) {
    response = redirectTo(request, loginErrorPath);
    await supabase.auth.signOut();
    return response;
  }

  return response;
}
