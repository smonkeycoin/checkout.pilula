import { NextRequest, NextResponse } from "next/server";
import { adminUnauthorizedBody, verifyAdminRequest } from "@/lib/admin-auth";
import {
  buildDashboardData,
  dashboardSupabaseError,
  parseDashboardRange,
  rangeStart,
  type DashboardInvoiceRow,
  type DashboardInviteRow,
  type DashboardOrderRow,
  type DashboardOtpRow
} from "@/lib/admin/dashboard";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function tableError(table: string, error: { code?: string; message?: string; details?: string; hint?: string }) {
  console.error("[admin_dashboard:supabase]", {
    table,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint
  });
  return NextResponse.json(
    dashboardSupabaseError(table),
    { status: 500 }
  );
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin.ok) return NextResponse.json(adminUnauthorizedBody(admin.reason), { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase no configurado", code: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
  }

  const range = parseDashboardRange(request.nextUrl.searchParams.get("range"));
  const start = rangeStart(range);

  let ordersQuery = supabase
    .from("pilula_orders")
    .select(
      "id,reference,profile_type,status,stripe_checkout_session_id,stripe_payment_intent_id,stripe_customer_id,full_name,email,phone,currency,payment_method,amount_subtotal,amount_tax,amount_total,amount_received,amount_remaining,payment_invite_id,payment_expires_at,created_at,updated_at,paid_at"
    )
    .order("created_at", { ascending: false });
  let invitesQuery = supabase
    .from("payment_invites")
    .select("id,profile_type,status,created_at,approved_at,opened_at,expires_at,revoked_at")
    .order("created_at", { ascending: false });
  let otpsQuery = supabase
    .from("payment_invite_otps")
    .select("invite_id,verified_at,created_at")
    .order("created_at", { ascending: false });
  let invoicesQuery = supabase
    .from("invoice_requests")
    .select("id,order_id,status,created_at")
    .order("created_at", { ascending: false });

  if (start) {
    const iso = start.toISOString();
    ordersQuery = ordersQuery.gte("created_at", iso);
    invitesQuery = invitesQuery.gte("created_at", iso);
    otpsQuery = otpsQuery.gte("created_at", iso);
    invoicesQuery = invoicesQuery.gte("created_at", iso);
  }

  const [ordersResult, invitesResult, otpsResult, invoicesResult] = await Promise.all([
    ordersQuery,
    invitesQuery,
    otpsQuery,
    invoicesQuery
  ]);

  if (ordersResult.error) return tableError("pilula_orders", ordersResult.error);
  if (invitesResult.error) return tableError("payment_invites", invitesResult.error);
  if (otpsResult.error) return tableError("payment_invite_otps", otpsResult.error);
  if (invoicesResult.error) return tableError("invoice_requests", invoicesResult.error);

  return NextResponse.json(
    buildDashboardData({
      range,
      orders: (ordersResult.data || []) as DashboardOrderRow[],
      invites: (invitesResult.data || []) as DashboardInviteRow[],
      otps: (otpsResult.data || []) as DashboardOtpRow[],
      invoices: (invoicesResult.data || []) as DashboardInvoiceRow[]
    })
  );
}
