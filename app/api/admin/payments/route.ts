import { NextRequest, NextResponse } from "next/server";
import { adminUnauthorizedBody, verifyAdminRequest } from "@/lib/admin-auth";
import { toCsv } from "@/lib/csv";
import { getEnv, getStripeEnvironment } from "@/lib/env";
import { redact } from "@/lib/security/text";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin.ok) return NextResponse.json(adminUnauthorizedBody(admin.reason), { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ payments: [] });
  const stripeEnvironment = getStripeEnvironment(getEnv().STRIPE_SECRET_KEY);
  let query = supabase.from("pilula_orders").select("*").order("created_at", { ascending: false });
  if (stripeEnvironment) {
    query = query.eq("environment", stripeEnvironment).eq("livemode", stripeEnvironment === "live");
    if (stripeEnvironment === "live") {
      query = query.eq("excluded_from_kpis", false).eq("is_internal_test", false);
    }
  }

  const { data, error } = await query;
  if (error && (error.code === "42703" || String(error.message || "").includes("column"))) {
    console.warn("[admin_payments:live_filter_missing_columns]", {
      stripeEnvironment,
      code: error.code
    });
    const emptyPayments: Array<Record<string, unknown>> = [];
    if (request.nextUrl.searchParams.get("format") === "csv") {
      return new NextResponse(toCsv(emptyPayments), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": "attachment; filename=pagos-pilula.csv"
        }
      });
    }
    return NextResponse.json({ payments: emptyPayments });
  }
  if (error) return NextResponse.json({ error: "No se pudieron cargar pagos" }, { status: 500 });

  const payments = ((data || []) as Array<Record<string, unknown>>).map((row) => {
    const {
      stripe_customer_id: stripeCustomerId,
      stripe_checkout_session_id: stripeCheckoutSessionId,
      stripe_payment_intent_id: stripePaymentIntentId,
      ...safeRow
    } = row;

    return {
      ...safeRow,
      stripe_customer_id_redacted: redact(String(stripeCustomerId || "")),
      stripe_checkout_session_id_redacted: redact(String(stripeCheckoutSessionId || "")),
      stripe_payment_intent_id_redacted: redact(String(stripePaymentIntentId || ""))
    };
  });

  if (request.nextUrl.searchParams.get("format") === "csv") {
    return new NextResponse(toCsv(payments), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=pagos-pilula.csv"
      }
    });
  }

  return NextResponse.json({ payments });
}
