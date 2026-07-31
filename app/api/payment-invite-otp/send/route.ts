import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendPaymentInviteOtpEmail } from "@/lib/email";
import { createInviteOtp, maskEmail } from "@/lib/payment-invite-otp";
import { getPaymentInviteByToken } from "@/lib/payment-invites";
import { getClientIp, validateOrigin } from "@/lib/security/origin";
import { rateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  inviteToken: z.string().min(20).max(256)
});

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }

  const limited = rateLimit(`invite-otp-send:${getClientIp(request)}`, 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Demasiados intentos. Intenta de nuevo en un momento." }, { status: 429 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Datos invalidos." }, { status: 400 });

  const inviteResult = await getPaymentInviteByToken(parsed.data.inviteToken);
  if (!inviteResult.ok) {
    return NextResponse.json({ error: "La invitación no es válida o ya expiró." }, { status: 403 });
  }

  const otp = await createInviteOtp({ inviteId: inviteResult.invite.id, email: inviteResult.invite.email });
  if (!otp.ok) {
    if (otp.reason === "cooldown" || otp.reason === "hourly_limit") {
      return NextResponse.json(
        {
          error: "Espera antes de solicitar otro código.",
          code: otp.reason,
          retryAfterSeconds: otp.retryAfterSeconds,
          maskedEmail: maskEmail(inviteResult.invite.email)
        },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: "No se pudo generar el código." }, { status: 500 });
  }

  const sent = await sendPaymentInviteOtpEmail({
    email: inviteResult.invite.email,
    code: otp.code,
    expiresInMinutes: 10
  });
  if (!sent.sent) {
    return NextResponse.json({ error: "No se pudo enviar el código." }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    maskedEmail: maskEmail(inviteResult.invite.email),
    resendAvailableAt: otp.resendAvailableAt
  });
}
