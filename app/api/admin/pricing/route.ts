import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminUnauthorizedBody, verifyAdminRequest } from "@/lib/admin-auth";
import { parseRateToMicros } from "@/lib/money";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const schema = z.object({
  rate: z.string().min(1),
  effectiveFrom: z.string().datetime().optional(),
  effectiveUntil: z.string().datetime().nullable().optional(),
  status: z.enum(["active", "inactive"]).default("active")
});

export async function GET(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin.ok) return NextResponse.json(adminUnauthorizedBody(admin.reason), { status: 401 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ rates: [] });
  const { data, error } = await supabase.from("exchange_rates").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "No se pudieron cargar tipos de cambio" }, { status: 500 });
  const { data: changes } = await supabase
    .from("fx_rate_changes")
    .select("*")
    .order("changed_at", { ascending: false })
    .limit(25);
  const current =
    (data || []).find((row) => row.status === "active" && row.source === "PILULA_MANAGED_FIXED") || {
      key: "USD_MXN_RATE",
      rate: "17.50",
      source: "PILULA_MANAGED_FIXED",
      status: "active"
    };
  return NextResponse.json({ rates: data, currentRate: current, changes: changes || [] });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin.ok) return NextResponse.json(adminUnauthorizedBody(admin.reason), { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
  try {
    parseRateToMicros(parsed.data.rate);
    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });
    const now = new Date();
    const effectiveFrom = parsed.data.effectiveFrom ? new Date(parsed.data.effectiveFrom) : now;
    const { data: previous } = await supabase
      .from("exchange_rates")
      .select("*")
      .eq("status", "active")
      .lte("effective_from", now.toISOString())
      .or(`effective_until.is.null,effective_until.gte.${now.toISOString()}`)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (parsed.data.status === "active") {
      await supabase
        .from("exchange_rates")
        .update({ status: "inactive", effective_until: now.toISOString() })
        .eq("status", "active")
        .is("effective_until", null);
    }

    const { error } = await supabase.from("exchange_rates").insert({
      key: "USD_MXN_RATE",
      rate: parsed.data.rate,
      source: "PILULA_MANAGED_FIXED",
      effective_from: effectiveFrom.toISOString(),
      effective_until: parsed.data.effectiveUntil || null,
      created_by: admin.email,
      status: parsed.data.status
    });
    if (error) throw error;
    const audit = await supabase.from("fx_rate_changes").insert({
      key: "USD_MXN_RATE",
      previous_rate: previous?.rate || null,
      new_rate: parsed.data.rate,
      changed_by: admin.email,
      changed_at: now.toISOString()
    });
    if (audit.error && audit.error.code !== "PGRST204" && audit.error.code !== "42P01") {
      console.error("[admin_pricing:audit_failed]", {
        code: audit.error.code,
        message: audit.error.message,
        details: audit.error.details,
        hint: audit.error.hint
      });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo guardar el tipo de cambio" }, { status: 500 });
  }
}
