import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  inviteCreateErrorResponse,
  logPaymentInviteCreateError
} from "@/lib/admin-invite-errors";
import { verifyAdminRequest } from "@/lib/admin-auth";
import { sendPaymentInviteEmail } from "@/lib/email";
import { buildPaymentInviteUrl, buildWhatsappUrl, createPaymentInvite } from "@/lib/payment-invites";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const createSchema = z.object({
  profileType: z.enum(["doctor", "patient"]),
  market: z.enum(["mexico", "international"]),
  paymentCurrency: z.enum(["usd", "mxn"]),
  allowedPaymentMethods: z.enum(["card", "bank_transfer", "card_and_bank_transfer"]),
  exchangeRate: z.string().optional(),
  fullName: z.string().min(1).max(180),
  email: z.string().email(),
  whatsapp: z.string().max(40).optional(),
  expiresAt: z.string().datetime(),
  approved: z.boolean().default(true),
  sendEmail: z.boolean().default(false)
});

export async function GET(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ invites: [] });
  const { data, error } = await supabase.from("payment_invites").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "No se pudieron cargar invitaciones" }, { status: 500 });
  return NextResponse.json({ invites: data });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: 401 });

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    const invalidDate = parsed.error.issues.some((issue) => issue.path.join(".") === "expiresAt");
    if (invalidDate) {
      return NextResponse.json(
        { error: "La fecha de vencimiento no es válida.", code: "INVITE_INVALID_DATE" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
  }

  const expiresAt = new Date(parsed.data.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) {
    return NextResponse.json(
      { error: "La fecha de vencimiento no es válida.", code: "INVITE_INVALID_DATE" },
      { status: 400 }
    );
  }

  try {
    const { invite, token } = await createPaymentInvite({
      profileType: parsed.data.profileType,
      market: parsed.data.market,
      paymentCurrency: parsed.data.paymentCurrency,
      allowedPaymentMethods: parsed.data.allowedPaymentMethods,
      exchangeRate: parsed.data.exchangeRate,
      exchangeRateSource: parsed.data.exchangeRate ? "admin" : undefined,
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      whatsapp: parsed.data.whatsapp,
      expiresAt,
      approved: parsed.data.approved,
      createdBy: admin.email
    });
    const url = buildPaymentInviteUrl(token);
    if (parsed.data.sendEmail) {
      try {
        await sendPaymentInviteEmail(invite, url);
      } catch (emailError) {
        const resendError = {
          code: "RESEND_ERROR",
          message: emailError instanceof Error ? emailError.message : "Resend invite email failed"
        };
        logPaymentInviteCreateError(resendError);
        return NextResponse.json(inviteCreateErrorResponse(resendError), { status: 502 });
      }
    }
    return NextResponse.json({ invite, url, whatsappUrl: buildWhatsappUrl(invite, url) });
  } catch (error) {
    logPaymentInviteCreateError(error);
    const status = inviteCreateErrorResponse(error).code === "INVITE_MXN_RATE_MISSING" ? 400 : 500;
    return NextResponse.json(inviteCreateErrorResponse(error), { status });
  }
}
