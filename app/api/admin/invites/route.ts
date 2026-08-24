import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  inviteCreateErrorResponse,
  logPaymentInviteCreateError
} from "@/lib/admin-invite-errors";
import { adminUnauthorizedBody, verifyAdminRequest } from "@/lib/admin-auth";
import { sendPaymentInviteEmail } from "@/lib/email";
import { buildPaymentInviteUrl, buildWhatsappUrl, createPaymentInvite } from "@/lib/payment-invites";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const createSchema = z.object({
  profileType: z.enum(["doctor", "patient"]),
  market: z.enum(["mexico", "international"]),
  paymentCurrency: z.enum(["usd", "mxn"]),
  allowedPaymentMethods: z.enum(["card", "bank_transfer", "card_and_bank_transfer"]),
  paymentOption: z.enum(["full", "deposit"]).default("full"),
  discountPercent: z.coerce.number().int().min(0).max(99).default(0),
  exchangeRate: z.string().optional(),
  fullName: z.string().min(1).max(180),
  email: z.string().email(),
  whatsapp: z.string().max(40).optional(),
  expiresAt: z.string().datetime(),
  approved: z.boolean().default(true),
  sendEmail: z.boolean().default(false),
  internalTest: z.boolean().optional().default(false)
});

function validationErrorMessage(issues: z.ZodIssue[]) {
  const paths = new Set(issues.map((issue) => issue.path.join(".")));
  if (paths.has("fullName")) return "Captura el nombre de la persona invitada.";
  if (paths.has("email")) return "Captura un correo válido.";
  if (paths.has("expiresAt")) return "La fecha de vencimiento no es válida.";
  if (paths.has("paymentOption")) return "Selecciona pago completo o anticipo 50%.";
  if (paths.has("discountPercent")) return "El descuento debe ser un porcentaje entero entre 0 y 99.";
  return "Revisa los campos obligatorios de la invitación.";
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin.ok) return NextResponse.json(adminUnauthorizedBody(admin.reason), { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ invites: [] });
  const showInternal = request.nextUrl.searchParams.get("showInternal") === "true";
  let query = supabase.from("payment_invites").select("*").order("created_at", { ascending: false });
  if (!showInternal) {
    query = query.eq("excluded_from_kpis", false).eq("is_internal_test", false);
  }
  const { data, error } = await query;
  if (error && (error.code === "42703" || String(error.message || "").includes("column"))) {
    return NextResponse.json({ invites: [] });
  }
  if (error) return NextResponse.json({ error: "No se pudieron cargar invitaciones" }, { status: 500 });
  return NextResponse.json({ invites: data });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin.ok) return NextResponse.json(adminUnauthorizedBody(admin.reason), { status: 401 });

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    const invalidDate = parsed.error.issues.some((issue) => issue.path.join(".") === "expiresAt");
    if (invalidDate) {
      return NextResponse.json(
        { error: "La fecha de vencimiento no es válida.", code: "INVITE_INVALID_DATE" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: validationErrorMessage(parsed.error.issues), code: "INVITE_VALIDATION_FAILED" },
      { status: 400 }
    );
  }

  const expiresAt = new Date(parsed.data.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) {
    return NextResponse.json(
      { error: "La fecha de vencimiento no es válida.", code: "INVITE_INVALID_DATE" },
      { status: 400 }
    );
  }

  try {
    const internalHeader = request.headers.get("x-pilula-internal-test") === "true";
    const internalTest = Boolean(parsed.data.internalTest || internalHeader);
    const { invite, token } = await createPaymentInvite({
      profileType: parsed.data.profileType,
      market: parsed.data.market,
      paymentCurrency: parsed.data.paymentCurrency,
      allowedPaymentMethods: parsed.data.allowedPaymentMethods,
      paymentOption: parsed.data.paymentOption,
      discountPercent: parsed.data.discountPercent,
      exchangeRate: parsed.data.exchangeRate,
      exchangeRateSource: parsed.data.exchangeRate ? "admin" : undefined,
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      whatsapp: parsed.data.whatsapp,
      expiresAt,
      approved: parsed.data.approved,
      createdBy: admin.email,
      internalTest,
      excludedFromKpis: internalTest
    });
    const url = buildPaymentInviteUrl(token);
    console.info("[INVITATION_CREATED]", {
      inviteId: invite.id,
      profileType: invite.profile_type,
      paymentOption: invite.payment_option || "full",
      currency: invite.payment_currency,
      discountPercent: Number(invite.discount_percent || 0),
      status: invite.status,
      livemode: Boolean(invite.livemode),
      internalTest
    });
    let emailStatus:
      | { requested: false; sent: false }
      | { requested: true; sent: true; emailId?: string }
      | { requested: true; sent: false; reason: string; errorCode?: string };

    if (parsed.data.sendEmail) {
      try {
        const sent = await sendPaymentInviteEmail(invite, url);
        emailStatus = sent.sent
          ? { requested: true, sent: true, emailId: sent.emailId }
          : {
              requested: true,
              sent: false,
              reason: sent.reason || "email_send_failed",
              errorCode: sent.errorCode
            };
      } catch (emailError) {
        const resendError = {
          code: "RESEND_ERROR",
          message: emailError instanceof Error ? emailError.message : "Resend invite email failed"
        };
        logPaymentInviteCreateError(resendError);
        emailStatus = {
          requested: true,
          sent: false,
          reason: "resend_error",
          errorCode: "RESEND_ERROR"
        };
      }
    } else {
      emailStatus = { requested: false, sent: false };
    }
    return NextResponse.json({ invite, url, whatsappUrl: buildWhatsappUrl(invite, url), email: emailStatus });
  } catch (error) {
    logPaymentInviteCreateError(error);
    const status = inviteCreateErrorResponse(error).code === "INVITE_MXN_RATE_MISSING" ? 400 : 500;
    return NextResponse.json(inviteCreateErrorResponse(error), { status });
  }
}
