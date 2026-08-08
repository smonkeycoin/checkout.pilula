import { NextResponse } from "next/server";
import { assertLiveLegalReady } from "@/config/legal";
import { getEnv, isPlaceholder } from "@/lib/env";

export const runtime = "nodejs";

export function GET() {
  const env = getEnv();
  const legal = assertLiveLegalReady();

  return NextResponse.json({
    ok: true,
    service: "pilula-checkout",
    mode: process.env.NODE_ENV || "development",
    configured: {
      stripe:
        !isPlaceholder(env.STRIPE_SECRET_KEY) &&
        !isPlaceholder(env.STRIPE_PRICE_DOCTOR) &&
        !isPlaceholder(env.STRIPE_PRICE_DOCTOR_MXN_FULL) &&
        !isPlaceholder(env.STRIPE_PRICE_DOCTOR_MXN_DEPOSIT) &&
        !isPlaceholder(env.STRIPE_PRICE_PATIENT_MXN_FULL) &&
        !isPlaceholder(env.STRIPE_PRICE_PATIENT_MXN_DEPOSIT),
      supabase: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
      resend: Boolean(env.RESEND_API_KEY),
      legalApproved: legal.approved
    }
  });
}
