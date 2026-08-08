import { NextRequest, NextResponse } from "next/server";
import { EnvConfigurationError, assertPaymentRuntimeReady } from "@/lib/env";
import { getOrderByPublicToken, markBalanceCheckoutOpen } from "@/lib/orders";
import { validateOrigin } from "@/lib/security/origin";
import { createBalanceCheckoutSession } from "@/lib/stripe/checkout-session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
    }

    assertPaymentRuntimeReady();
    const formData = await request.formData();
    const token = String(formData.get("token") || "");
    if (!token) {
      return NextResponse.json({ error: "Token inválido." }, { status: 400 });
    }

    const order = await getOrderByPublicToken(token);
    const amountDue = (order?.amount_remaining || order?.balance_amount || 0) as number;
    if (
      !order ||
      order.payment_option !== "deposit" ||
      order.deposit_status !== "paid" ||
      order.balance_status !== "pending" ||
      amountDue <= 0
    ) {
      return NextResponse.json({ error: "Esta orden no tiene saldo pendiente disponible." }, { status: 403 });
    }

    const session = await createBalanceCheckoutSession(order, token);
    await markBalanceCheckoutOpen(order.id, session);
    if (!session.url) {
      return NextResponse.json({ error: "No pudimos preparar el pago." }, { status: 500 });
    }
    return NextResponse.redirect(session.url, { status: 303 });
  } catch (error) {
    if (error instanceof EnvConfigurationError) {
      console.error("[balance_checkout_env]", { code: error.code });
      return NextResponse.json({ error: "El pago aún no está configurado." }, { status: 503 });
    }
    console.error("[balance_checkout]", {
      type: error instanceof Error ? error.name : typeof error,
      message: process.env.NODE_ENV !== "production" && error instanceof Error ? error.message : undefined
    });
    return NextResponse.json({ error: "No pudimos preparar el pago." }, { status: 500 });
  }
}
