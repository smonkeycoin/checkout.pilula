import { NextRequest, NextResponse } from "next/server";
import { assertLiveLegalReady } from "@/config/legal";
import { canCheckoutInvite, validateCheckoutPayload } from "@/lib/checkout-guard";
import { getEnv, isLiveStripeKey, isPlaceholder } from "@/lib/env";
import { sendBankTransferInstructionsEmail } from "@/lib/email";
import { createOrderFromInvite, markOrderCheckoutOpen } from "@/lib/orders";
import { isInviteOtpVerified } from "@/lib/payment-invite-otp";
import { getPaymentInviteByToken } from "@/lib/payment-invites";
import { getClientIp, validateOrigin } from "@/lib/security/origin";
import { rateLimit } from "@/lib/security/rate-limit";
import { createCheckoutSession } from "@/lib/stripe/checkout-session";

export const runtime = "nodejs";

type CheckoutErrorContext = {
  inviteId?: string;
  orderId?: string;
  paymentMethod?: string;
  currency?: string;
  stripePriceId?: string | null;
  taxRateId?: string;
};

type StripeCheckoutError = Error & {
  type?: string;
  code?: string;
  rawType?: string;
  requestId?: string;
  raw?: {
    type?: string;
    requestId?: string;
  };
};

function isStripeError(error: unknown): error is StripeCheckoutError {
  return (
    error instanceof Error &&
    "type" in error &&
    typeof (error as StripeCheckoutError).type === "string" &&
    Boolean((error as StripeCheckoutError).type?.startsWith("Stripe"))
  );
}

export async function POST(request: NextRequest) {
  const context: CheckoutErrorContext = {};

  try {
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
    }

    const limited = rateLimit(`checkout:${getClientIp(request)}`, 10, 60_000);
    if (!limited.ok) {
      return NextResponse.json({ error: "Demasiados intentos. Intenta de nuevo en un momento." }, { status: 429 });
    }

    const parsed = validateCheckoutPayload(await request.json());
    if (!parsed.success || parsed.data.website) {
      return NextResponse.json({ error: "Datos invalidos." }, { status: 400 });
    }

    const inviteResult = await getPaymentInviteByToken(parsed.data.inviteToken);
    if (!inviteResult.ok) {
      return NextResponse.json({ error: "La invitacion no es valida, no esta aprobada o ya expiro." }, { status: 403 });
    }
    context.inviteId = inviteResult.invite.id;
    context.paymentMethod = parsed.data.paymentMethod;
    context.currency = inviteResult.invite.payment_currency;
    context.stripePriceId = inviteResult.invite.stripe_price_id;

    if (!isInviteOtpVerified(request, inviteResult.invite.id)) {
      return NextResponse.json({ error: "Verifica tu correo antes de continuar al pago." }, { status: 403 });
    }

    const checkoutAllowed = canCheckoutInvite(inviteResult.invite, parsed.data.plan, parsed.data.paymentMethod);
    if (!checkoutAllowed.ok) {
      return NextResponse.json({ error: "La invitacion no permite esta modalidad o metodo de pago." }, { status: 403 });
    }

    const env = getEnv();
    context.taxRateId = env.STRIPE_TAX_RATE_IVA_16;
    const legal = assertLiveLegalReady();
    if (process.env.NODE_ENV === "production" && isLiveStripeKey(env.STRIPE_SECRET_KEY) && !legal.approved) {
      return NextResponse.json({ error: "Lanzamiento live bloqueado hasta aprobacion legal." }, { status: 503 });
    }

    if (
      isPlaceholder(env.STRIPE_SECRET_KEY) ||
      isPlaceholder(env.STRIPE_TAX_RATE_IVA_16) ||
      (inviteResult.invite.payment_currency === "usd" && isPlaceholder(inviteResult.invite.stripe_price_id || ""))
    ) {
      return NextResponse.json({ error: "Stripe aun no esta configurado." }, { status: 503 });
    }

    const order = await createOrderFromInvite({
      invite: inviteResult.invite,
      userAgent: request.headers.get("user-agent") || "",
      paymentMethod: parsed.data.paymentMethod,
      metadata: {
        invite_bound: true
      }
    });
    context.orderId = order.id;
    const session = await createCheckoutSession({
      plan: inviteResult.invite.profile_type,
      order,
      invite: inviteResult.invite,
      paymentMethod: parsed.data.paymentMethod
    });
    await markOrderCheckoutOpen(order.id, session, parsed.data.paymentMethod);
    if (parsed.data.paymentMethod === "bank_transfer") {
      await sendBankTransferInstructionsEmail(order, session);
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (isStripeError(error)) {
      console.error("[stripe_checkout]", {
        type: error.type,
        code: error.code,
        message: error.message,
        rawType: error.rawType || error.raw?.type,
        requestId: error.requestId || error.raw?.requestId,
        stack: error.stack,
        ...context
      });

      if (process.env.NODE_ENV !== "production") {
        return NextResponse.json(
          {
            error: "STRIPE_CHECKOUT_FAILED",
            stripeCode: error.code || null,
            stripeMessage: error.message
          },
          { status: 500 }
        );
      }
    } else {
      console.error("[stripe_checkout]", {
        type: error instanceof Error ? error.name : typeof error,
        code: undefined,
        message: error instanceof Error ? error.message : String(error),
        rawType: undefined,
        requestId: undefined,
        stack: error instanceof Error ? error.stack : undefined,
        ...context
      });
    }

    return NextResponse.json({ error: "No pudimos preparar el pago. Intenta nuevamente." }, { status: 500 });
  }
}
