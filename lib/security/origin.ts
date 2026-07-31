import { NextRequest } from "next/server";
import { getEnv } from "@/lib/env";

export function validateOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const env = getEnv();
  const siteUrl = new URL(env.NEXT_PUBLIC_SITE_URL);

  if (!origin) return true;

  try {
    const parsed = new URL(origin);
    return parsed.host === siteUrl.host || Boolean(host && parsed.host === host);
  } catch {
    return false;
  }
}

export function getClientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
