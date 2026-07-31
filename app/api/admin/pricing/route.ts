import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAdminRequest } from "@/lib/admin-auth";
import { parseRateToMicros } from "@/lib/money";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const schema = z.object({
  rate: z.string().min(1),
  effectiveFrom: z.string().datetime(),
  effectiveUntil: z.string().datetime().nullable().optional(),
  status: z.enum(["active", "inactive"])
});

export async function GET(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: 401 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ rates: [] });
  const { data, error } = await supabase.from("exchange_rates").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "No se pudieron cargar tipos de cambio" }, { status: 500 });
  return NextResponse.json({ rates: data });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
  try {
    parseRateToMicros(parsed.data.rate);
    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
    const { error } = await supabase.from("exchange_rates").insert({
      key: "USD_MXN_RATE",
      rate: parsed.data.rate,
      source: "PILULA",
      effective_from: parsed.data.effectiveFrom,
      effective_until: parsed.data.effectiveUntil || null,
      created_by: admin.email,
      status: parsed.data.status
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo guardar el tipo de cambio" }, { status: 500 });
  }
}
