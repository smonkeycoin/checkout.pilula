import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getEnv } from "@/lib/env";
import { notifyManualReview, sendPaymentEmails } from "@/lib/email";
import {
  findAwaitingBankTransferOrder,
  getOrderBySession,
  markOrderPaid,
  markOrderPaidFromPaymentIntent,
  updateOrderFunding,
  updateOrderStatusFromEvent
} from "@/lib/orders";
import { getStripe } from "@/lib/stripe/client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

async function recordEvent(eventId: string, eventType: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { duplicate: false };

  const { error } = await supabase.from("stripe_events").insert({
    event_id: eventId,
    event_type: eventType,
    status: "processing",
    received_at: new Date().toISOString()
  });

  if (error?.code === "23505") return { duplicate: true };
  if (error) throw new Error("No se pudo registrar el evento");
  return { duplicate: false };
}

async function finishEvent(eventId: string, status: "processed" | "failed", errorMessage?: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  await supabase
    .from("stripe_events")
    .update({
      status,
      error_message: errorMessage?.slice(0, 240) || null,
      processed_at: new Date().toISOString()
    })
    .eq("event_id", eventId);
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const stripe = getStripe();
  const hydrated =
    session.payment_status === "paid"
      ? session
      : await stripe.checkout.sessions.retrieve(session.id, {
          expand: ["payment_intent"]
        });

  const result = await markOrderPaid(hydrated);
  if (result.updated) {
    const order = await getOrderBySession(hydrated.id);
    if (order?.status === "paid") await sendPaymentEmails(order);
  }
}

async function handleCashBalanceTransaction(transaction: Stripe.CustomerCashBalanceTransaction) {
  if (transaction.currency !== "mxn") return;
  const customerId = typeof transaction.customer === "string" ? transaction.customer : transaction.customer.id;
  const order = await findAwaitingBankTransferOrder(customerId, transaction.currency);
  if (!order) return;
  const received = transaction.ending_balance;
  const expired = Boolean(order.payment_expires_at && Date.now() > new Date(order.payment_expires_at).getTime());
  const result = await updateOrderFunding(order, received, {
    expired
  });
  if (result.status === "paid") {
    await sendPaymentEmails({ ...order, status: "paid", amount_received: received, amount_remaining: 0 });
  }
  if (expired && result.status === "requires_manual_review") {
    await notifyManualReview({ orderReference: order.reference, reason: "Pago SPEI recibido después del vencimiento" });
  }
}

export async function POST(request: NextRequest) {
  const env = getEnv();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = getStripe().webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const recorded = await recordEvent(event.id, event.type);
    if (recorded.duplicate) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "payment_intent.succeeded":
        await markOrderPaidFromPaymentIntent(event.data.object as Stripe.PaymentIntent);
        break;
      case "checkout.session.expired":
        await updateOrderStatusFromEvent((event.data.object as Stripe.Checkout.Session).id, "expired");
        break;
      case "checkout.session.async_payment_failed":
        await updateOrderStatusFromEvent((event.data.object as Stripe.Checkout.Session).id, "failed");
        break;
      case "payment_intent.payment_failed":
        break;
      case "customer_cash_balance_transaction.created":
        await handleCashBalanceTransaction(event.data.object as Stripe.CustomerCashBalanceTransaction);
        break;
      case "charge.refunded":
      case "charge.dispute.created":
        break;
      default:
        break;
    }

    await finishEvent(event.id, "processed");
    return NextResponse.json({ received: true });
  } catch (error) {
    await finishEvent(event.id, "failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
