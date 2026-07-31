import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { maskEmail, setInviteOtpCookie, verifyInviteOtp } from "@/lib/payment-invite-otp";
import { getPaymentInviteByToken } from "@/lib/payment-invites";
import { getClientIp, validateOrigin } from "@/lib/security/origin";
import { rateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  inviteToken: z.string().min(20).max(256),
  code: z.string().regex(/^\d{6}$/)
});

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }

  const limited = rateLimit(`invite-otp-verify:${getClientIp(request)}`, 30, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Demasiados intentos. Intenta de nuevo en un momento." }, { status: 429 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Ingresa un código de 6 dígitos." }, { status: 400 });

  const inviteResult = await getPaymentInviteByToken(parsed.data.inviteToken);
  if (!inviteResult.ok) {
    return NextResponse.json({ error: "La invitación no es válida o ya expiró." }, { status: 403 });
  }

  const verified = await verifyInviteOtp({
    inviteId: inviteResult.invite.id,
    email: inviteResult.invite.email,
    code: parsed.data.code
  });

  if (!verified.ok) {
    const tooMany = verified.reason === "too_many_attempts";
    return NextResponse.json(
      {
        error: tooMany ? "Demasiados intentos. Solicita un nuevo código." : "Código inválido o vencido.",
        code: verified.reason,
        maskedEmail: maskEmail(inviteResult.invite.email)
      },
      { status: tooMany ? 429 : 400 }
    );
  }

  const response = NextResponse.json({
    ok: true,
    maskedEmail: maskEmail(inviteResult.invite.email)
  });
  setInviteOtpCookie(response, inviteResult.invite.id);
  return response;
}
