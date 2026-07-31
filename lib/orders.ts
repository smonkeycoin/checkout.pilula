import crypto from "node:crypto";
import type Stripe from "stripe";
import { PLANS, type PaymentCurrency, type PaymentMethod, type PlanKey } from "@/config/checkout";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSignedInvoiceToken } from "@/lib/security/tokens";
import { sanitizeText } from "@/lib/security/text";
import type { PaymentInvite } from "@/lib/payment-invites";
import { markPaymentInvitePaid } from "@/lib/payment-invites";

export type OrderRecord = {
  id: string;
  reference: string;
  profile_type: PlanKey;
  status: string;
  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_customer_id?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  specialty?: string | null;
  city_country?: string | null;
  currency: PaymentCurrency;
  payment_method?: PaymentMethod | null;
  amount_subtotal: number;
  amount_tax: number;
  amount_total: number;
  amount_received?: number;
  amount_remaining?: number;
  exchange_rate_mxn_per_usd?: string | null;
  exchange_rate_source?: string | null;
  exchange_rate_locked_at?: string | null;
  payment_expires_at?: string | null;
  invoice_requested?: boolean;
  terms_version: string;
  terms_hash?: string | null;
  cancellation_policy_version?: string | null;
  payment_invite_id?: string | null;
  terms_accepted_at?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  paid_at?: string | null;
};

export function createOrderReference() {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `PILULA-HTW-${stamp}-${suffix}`;
}

export async function createOrderFromInvite(input: {
  invite: PaymentInvite;
  userAgent: string;
  paymentMethod: PaymentMethod;
  metadata?: Record<string, unknown>;
}) {
  const id = crypto.randomUUID();
  const order: OrderRecord = {
    id,
    reference: createOrderReference(),
    profile_type: input.invite.profile_type,
    status: "created",
    full_name: input.invite.full_name,
    email: input.invite.email,
    phone: input.invite.whatsapp,
    currency: input.invite.currency,
    payment_method: input.paymentMethod,
    amount_subtotal: input.invite.amount_subtotal,
    amount_tax: input.invite.amount_tax,
    amount_total: input.invite.amount_total,
    amount_received: 0,
    amount_remaining: input.invite.amount_total,
    exchange_rate_mxn_per_usd: input.invite.exchange_rate_mxn_per_usd,
    exchange_rate_source: input.invite.exchange_rate_source,
    exchange_rate_locked_at: input.invite.exchange_rate_locked_at,
    payment_expires_at: input.invite.expires_at,
    terms_version: input.invite.terms_version,
    terms_hash: input.invite.terms_hash,
    cancellation_policy_version: input.invite.cancellation_policy_version,
    payment_invite_id: input.invite.id,
    terms_accepted_at: new Date().toISOString(),
    user_agent: sanitizeText(input.userAgent, 400),
    metadata: input.metadata || {}
  };

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return order;
  }

  const { data, error } = await supabase.from("pilula_orders").insert(order).select("*").single();
  if (error) throw new Error("No se pudo crear la orden");
  return data as OrderRecord;
}

export async function markOrderCheckoutOpen(orderId: string, session: Stripe.Checkout.Session, paymentMethod: PaymentMethod) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  await supabase
    .from("pilula_orders")
    .update({
      status: paymentMethod === "bank_transfer" ? "awaiting_bank_transfer" : "awaiting_payment_method",
      stripe_checkout_session_id: session.id,
      stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer?.id || null,
      updated_at: new Date().toISOString()
    })
    .eq("id", orderId);
}

export async function getOrderBySession(sessionId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data } = await supabase.from("pilula_orders").select("*").eq("stripe_checkout_session_id", sessionId).maybeSingle();
  return (data as OrderRecord | null) || null;
}

export async function getOrderForInvoice(orderId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data } = await supabase.from("pilula_orders").select("*").eq("id", orderId).eq("status", "paid").maybeSingle();
  return (data as OrderRecord | null) || null;
}

export function extractStripeFields(session: Stripe.Checkout.Session) {
  const customFields = Object.fromEntries(
    (session.custom_fields || []).map((field) => [field.key, field.text?.value || field.dropdown?.value || ""])
  );
  const customer = session.customer_details;

  return {
    full_name: sanitizeText(customer?.name || "", 180),
    email: sanitizeText(customer?.email || "", 180),
    phone: sanitizeText(customer?.phone || "", 60),
    specialty: sanitizeText(String(customFields.specialty || ""), 120),
    city_country: sanitizeText(String(customFields.city_country || ""), 120)
  };
}

export async function markOrderPaid(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.order_id;
  if (!orderId || session.payment_status !== "paid") {
    return { updated: false, reason: "payment_status_not_paid" };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { updated: true, reason: "supabase_not_configured" };
  }

  const stripeFields = extractStripeFields(session);
  const paymentIntent =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null;

  const { error } = await supabase
    .from("pilula_orders")
    .update({
      status: "paid",
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntent,
      stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer?.id || null,
      ...stripeFields,
      amount_subtotal: session.amount_subtotal ?? undefined,
      amount_tax: session.total_details?.amount_tax ?? undefined,
      amount_total: session.amount_total ?? undefined,
      amount_received: session.amount_total ?? undefined,
      amount_remaining: 0,
      currency: (session.currency || "usd") as PaymentCurrency,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", orderId)
    .neq("status", "paid");

  if (error) throw new Error("No se pudo marcar la orden como pagada");

  if (session.metadata?.payment_invite_id) {
    await markPaymentInvitePaid(session.metadata.payment_invite_id);
  }

  return { updated: true };
}

export async function markOrderPaidFromPaymentIntent(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata?.order_id;
  if (!orderId || paymentIntent.status !== "succeeded") return { updated: false };
  const supabase = getSupabaseAdmin();
  if (!supabase) return { updated: true };
  const { data: current } = await supabase.from("pilula_orders").select("*").eq("id", orderId).maybeSingle();
  const order = current as OrderRecord | null;
  if (!order) return { updated: false };
  const expired = Boolean(order.payment_expires_at && Date.now() > new Date(order.payment_expires_at).getTime());
  const { error } = await supabase
    .from("pilula_orders")
    .update({
      status: expired ? "requires_manual_review" : "paid",
      stripe_payment_intent_id: paymentIntent.id,
      amount_received: paymentIntent.amount_received,
      amount_remaining: Math.max(order.amount_total - paymentIntent.amount_received, 0),
      paid_at: expired ? null : new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", orderId)
    .neq("status", "paid");
  if (error) throw new Error("No se pudo marcar la orden desde PaymentIntent");
  if (!expired && paymentIntent.amount_received >= order.amount_total && order.payment_invite_id) {
    await markPaymentInvitePaid(order.payment_invite_id);
  }
  return { updated: true };
}

export async function updateOrderStatusFromEvent(sessionId: string, status: "expired" | "failed" | "cancelled") {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  await supabase
    .from("pilula_orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("stripe_checkout_session_id", sessionId)
    .neq("status", "paid");
}

export async function findAwaitingBankTransferOrder(customerId: string, currency: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data } = await supabase
    .from("pilula_orders")
    .select("*")
    .eq("stripe_customer_id", customerId)
    .eq("currency", currency)
    .in("status", ["awaiting_bank_transfer", "partially_funded"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as OrderRecord | null) || null;
}

export async function updateOrderFunding(order: OrderRecord, amountReceived: number, options: { expired?: boolean } = {}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { status: "partially_funded" };
  const paid = amountReceived >= order.amount_total;
  const expired = options.expired;
  const status = paid ? (expired ? "requires_manual_review" : "paid") : "partially_funded";
  const amountRemaining = Math.max(order.amount_total - amountReceived, 0);
  await supabase
    .from("pilula_orders")
    .update({
      status,
      amount_received: amountReceived,
      amount_remaining: amountRemaining,
      paid_at: paid && !expired ? new Date().toISOString() : order.paid_at,
      updated_at: new Date().toISOString()
    })
    .eq("id", order.id);
  if (paid && !expired && order.payment_invite_id) await markPaymentInvitePaid(order.payment_invite_id);
  return { status, amountRemaining };
}

export function buildInvoiceLink(order: Pick<OrderRecord, "id">) {
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  const token = createSignedInvoiceToken(order.id, expiresAt);
  return token ? `/factura?order=${order.id}&token=${token}` : "/factura";
}

export function displayPlanName(plan: string) {
  return plan === "patient" ? PLANS.patient.displayTitle : PLANS.doctor.displayTitle;
}
