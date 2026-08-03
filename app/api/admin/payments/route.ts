import { NextRequest, NextResponse } from "next/server";
import { adminUnauthorizedBody, verifyAdminRequest } from "@/lib/admin-auth";
import { toCsv } from "@/lib/csv";
import { redact } from "@/lib/security/text";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin.ok) return NextResponse.json(adminUnauthorizedBody(admin.reason), { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ payments: [] });
  const { data, error } = await supabase.from("pilula_orders").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "No se pudieron cargar pagos" }, { status: 500 });

  const payments = ((data || []) as Array<Record<string, unknown>>).map((row) => ({
    ...row,
    stripe_customer_id_redacted: redact(String(row.stripe_customer_id || "")),
    stripe_checkout_session_id_redacted: redact(String(row.stripe_checkout_session_id || ""))
  }));

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
