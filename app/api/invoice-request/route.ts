import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { notifyInvoiceRequest } from "@/lib/email";
import { getOrderForInvoice } from "@/lib/orders";
import { getClientIp, validateOrigin } from "@/lib/security/origin";
import { rateLimit } from "@/lib/security/rate-limit";
import { sanitizeText } from "@/lib/security/text";
import { verifySignedInvoiceToken } from "@/lib/security/tokens";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const invoiceSchema = z
  .object({
    orderId: z.string().uuid(),
    token: z.string().min(20),
    rfc: z.string().min(12).max(13),
    legalName: z.string().min(2).max(180),
    taxRegime: z.string().min(2).max(120),
    fiscalPostalCode: z.string().regex(/^\d{5}$/),
    cfdiUse: z.string().min(2).max(80),
    invoiceEmail: z.string().email(),
    website: z.string().max(0).optional()
  })
  .strict();

export async function POST(request: NextRequest) {
  try {
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
    }
    const limited = rateLimit(`invoice:${getClientIp(request)}`, 6, 60_000);
    if (!limited.ok) {
      return NextResponse.json({ error: "Demasiados intentos. Intenta de nuevo en un momento." }, { status: 429 });
    }

    const parsed = invoiceSchema.safeParse(await request.json());
    if (!parsed.success || parsed.data.website) {
      return NextResponse.json({ error: "Datos invalidos." }, { status: 400 });
    }

    if (!verifySignedInvoiceToken(parsed.data.orderId, parsed.data.token)) {
      return NextResponse.json({ error: "El enlace de factura no es valido o expiro." }, { status: 403 });
    }

    const order = await getOrderForInvoice(parsed.data.orderId);
    if (!order) {
      return NextResponse.json({ error: "No encontramos una orden pagada para esta solicitud." }, { status: 404 });
    }

    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { error } = await supabase.from("invoice_requests").insert({
        order_id: parsed.data.orderId,
        rfc: sanitizeText(parsed.data.rfc, 13).toUpperCase(),
        legal_name: sanitizeText(parsed.data.legalName, 180),
        tax_regime: sanitizeText(parsed.data.taxRegime, 120),
        fiscal_postal_code: sanitizeText(parsed.data.fiscalPostalCode, 5),
        cfdi_use: sanitizeText(parsed.data.cfdiUse, 80),
        invoice_email: sanitizeText(parsed.data.invoiceEmail, 180),
        status: "solicitada",
        metadata: {}
      });
      if (error) throw new Error("No se pudo guardar la solicitud");

      await supabase.from("pilula_orders").update({ invoice_requested: true }).eq("id", parsed.data.orderId);
    }

    await notifyInvoiceRequest({ orderReference: order.reference, invoiceEmail: parsed.data.invoiceEmail });

    return NextResponse.json({
      ok: true,
      message: "Tu solicitud de factura fue recibida. La emision del CFDI sera procesada por el equipo administrativo de PILULA."
    });
  } catch {
    return NextResponse.json({ error: "No pudimos registrar la solicitud." }, { status: 500 });
  }
}
