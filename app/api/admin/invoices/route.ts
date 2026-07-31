import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAdminRequest } from "@/lib/admin-auth";
import { toCsv } from "@/lib/csv";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["solicitada", "en_revision", "requiere_correccion", "emitida", "enviada"])
});

export async function GET(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ invoices: [] });
  const { data, error } = await supabase.from("invoice_requests").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "No se pudieron cargar facturas" }, { status: 500 });

  if (request.nextUrl.searchParams.get("format") === "csv") {
    return new NextResponse(toCsv((data || []) as Array<Record<string, unknown>>), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=facturas-pilula.csv"
      }
    });
  }

  return NextResponse.json({ invoices: data });
}

export async function PATCH(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: 401 });

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
  const { error } = await supabase
    .from("invoice_requests")
    .update({ status: parsed.data.status, processed_at: new Date().toISOString() })
    .eq("id", parsed.data.id);
  if (error) return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
