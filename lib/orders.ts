import crypto from "node:crypto";
import type Stripe from "stripe";
import { PLANS, type PaymentCurrency, type PaymentMethod, type PlanKey } from "@/config/checkout";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSignedInvoiceToken } from "@/lib/security/tokens";
import { sanitizeText } from "@/lib/security/text";
import type { PaymentInvite } from "@/lib/payment-invites";
import { markPaymentInvitePaid } from "@/lib/payment-invites";
import { getStripeEnvironment, type StripeEnvironment } from "@/lib/env";

export type OrderRecord = {
  id: string;
  reference: string;
  profile_type: PlanKey;
  status: string;
  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_customer_id?: string | null;
  stripe_price_id?: string | null;
  stripe_event_id?: string | null;
  environment?: StripeEnvironment | null;
  livemode?: boolean | null;
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
  buyer_confirmation_sent_at?: string | null;
  buyer_confirmation_email_id?: string | null;
  owner_confirmation_sent_at?: string | null;
  owner_confirmation_email_id?: string | null;
  payment_option?: "full" | "deposit" | "balance" | string | null;
  deposit_amount?: number | null;
  balance_amount?: number | null;
  deposit_status?: string | null;
  balance_status?: string | null;
  deposit_paid_at?: string | null;
  balance_paid_at?: string | null;
  reminder_at?: string | null;
  reminder_sent_at?: string | null;
  balance_due_at?: string | null;
  public_token_hash?: string | null;
};

export type PaymentLinkOrderResolution = {
  participantType: PlanKey;
  paymentOption: "full" | "deposit";
  totalAmount: number;
  subtotalAmount: number;
  taxAmount: number;
  paidAmount: number;
};

const LIVE_PAYMENT_LINKS: Record<string, PaymentLinkOrderResolution> = {
  plink_1U1xKiGkqXZguX59hWdHVbuV: {
    participantType: "doctor",
    paymentOption: "full",
    totalAmount: 696000,
    subtotalAmount: 600000,
    taxAmount: 96000,
    paidAmount: 696000
  },
  plink_1U1xKjGkqXZguX59fsVHAQTM: {
    participantType: "doctor",
    paymentOption: "deposit",
    totalAmount: 696000,
    subtotalAmount: 600000,
    taxAmount: 96000,
    paidAmount: 348000
  },
  plink_1U1xKkGkqXZguX597exX33tg: {
    participantType: "patient",
    paymentOption: "full",
    totalAmount: 92800,
    subtotalAmount: 80000,
    taxAmount: 12800,
    paidAmount: 92800
  },
  plink_1U1xKkGkqXZguX59VQ66yTAt: {
    participantType: "patient",
    paymentOption: "deposit",
    totalAmount: 92800,
    subtotalAmount: 80000,
    taxAmount: 12800,
    paidAmount: 46400
  }
};

const LIVE_PAYMENT_LINK_PRICES: Record<string, PaymentLinkOrderResolution> = {
  price_1U1xKfGkqXZguX59serkxpFa: LIVE_PAYMENT_LINKS.plink_1U1xKiGkqXZguX59hWdHVbuV,
  price_1U1xKgGkqXZguX59rejzNjmi: LIVE_PAYMENT_LINKS.plink_1U1xKjGkqXZguX59fsVHAQTM,
  price_1U1xKhGkqXZguX597Mehgxun: LIVE_PAYMENT_LINKS.plink_1U1xKkGkqXZguX597exX33tg,
  price_1U1xKiGkqXZguX59Sznj0gSx: LIVE_PAYMENT_LINKS.plink_1U1xKkGkqXZguX59VQ66yTAt
};

function hashPublicToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createPublicOrderToken() {
  return crypto.randomBytes(24).toString("base64url");
}

export function resolvePaymentLinkOrder(session: Stripe.Checkout.Session) {
  const paymentLink = typeof session.payment_link === "string" ? session.payment_link : session.payment_link?.id;
  if (paymentLink && LIVE_PAYMENT_LINKS[paymentLink]) return LIVE_PAYMENT_LINKS[paymentLink];

  const metadata = session.metadata || {};
  const participantType = metadata.participant_type === "doctor" || metadata.profile_type === "doctor" ? "doctor" : metadata.participant_type === "patient" || metadata.profile_type === "patient" ? "patient" : null;
  const paymentOption = metadata.payment_type === "deposit" ? "deposit" : metadata.payment_type === "full" ? "full" : null;
  if (session.livemode && metadata.app === "pilula" && metadata.environment === "live" && participantType && paymentOption) {
    const key = Object.values(LIVE_PAYMENT_LINKS).find((candidate) => candidate.participantType === participantType && candidate.paymentOption === paymentOption);
    if (key) return key;
  }

  const priceId = session.metadata?.price_id;
  return priceId ? LIVE_PAYMENT_LINK_PRICES[priceId] || null : null;
}

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
  const stripeEnvironment = getStripeEnvironment() || "test";
  const order: OrderRecord = {
    id,
    reference: createOrderReference(),
    profile_type: input.invite.profile_type,
    status: "created",
    stripe_price_id: input.invite.stripe_price_id,
    environment: stripeEnvironment,
    livemode: stripeEnvironment === "live",
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
      environment: session.livemode ? "live" : "test",
      livemode: session.livemode,
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

export async function getReusableCheckoutOrder(input: {
  paymentInviteId: string;
  paymentMethod: PaymentMethod;
  livemode: boolean;
}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data } = await supabase
    .from("pilula_orders")
    .select("*")
    .eq("payment_invite_id", input.paymentInviteId)
    .eq("payment_method", input.paymentMethod)
    .eq("livemode", input.livemode)
    .in("status", ["awaiting_payment_method", "awaiting_bank_transfer"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
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

export async function markOrderPaid(session: Stripe.Checkout.Session, eventId?: string) {
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

  if (session.metadata?.payment_type === "balance") {
    const { data: current, error: currentError } = await supabase.from("pilula_orders").select("*").eq("id", orderId).maybeSingle();
    if (currentError) throw new Error("No se pudo consultar la orden de saldo");
    const order = current as OrderRecord | null;
    if (!order) return { updated: false, reason: "order_not_found" };
    const balancePaid = session.amount_total || order.amount_remaining || 0;
    const totalReceived = Math.min((order.amount_received || 0) + balancePaid, order.amount_total);
    const { error } = await supabase
      .from("pilula_orders")
      .update({
        status: "paid",
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: paymentIntent,
        stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer?.id || null,
        stripe_event_id: eventId || undefined,
        environment: session.livemode ? "live" : "test",
        livemode: session.livemode,
        ...stripeFields,
        amount_received: totalReceived,
        amount_remaining: 0,
        balance_status: "paid",
        balance_paid_at: new Date().toISOString(),
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId)
      .neq("status", "paid");
    if (error) throw new Error("No se pudo marcar el saldo como pagado");
    return { updated: true };
  }

  const { error } = await supabase
    .from("pilula_orders")
    .update({
      status: "paid",
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntent,
      stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer?.id || null,
      stripe_event_id: eventId || undefined,
      environment: session.livemode ? "live" : "test",
      livemode: session.livemode,
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

export async function createOrderFromPaymentLinkSession(session: Stripe.Checkout.Session, eventId: string) {
  if (session.payment_status !== "paid") return { order: null, publicToken: null, created: false, reason: "payment_status_not_paid" };
  const resolution = resolvePaymentLinkOrder(session);
  if (!resolution) return { order: null, publicToken: null, created: false, reason: "payment_link_not_recognized" };

  const supabase = getSupabaseAdmin();
  if (!supabase) return { order: null, publicToken: null, created: false, reason: "supabase_not_configured" };

  const existing = await getOrderBySession(session.id);
  if (existing) return { order: existing, publicToken: null, created: false, reason: "order_exists" };

  const stripeFields = extractStripeFields(session);
  const paymentIntent =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null;
  const paidAt = new Date();
  const publicToken = resolution.paymentOption === "deposit" ? createPublicOrderToken() : null;
  const balanceAmount = Math.max(resolution.totalAmount - resolution.paidAmount, 0);
  const order: OrderRecord = {
    id: crypto.randomUUID(),
    reference: createOrderReference(),
    profile_type: resolution.participantType,
    status: resolution.paymentOption === "deposit" ? "partial" : "paid",
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: paymentIntent,
    stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer?.id || null,
    stripe_event_id: eventId,
    environment: session.livemode ? "live" : "test",
    livemode: session.livemode,
    ...stripeFields,
    currency: (session.currency || "usd") as PaymentCurrency,
    payment_method: "card",
    amount_subtotal: resolution.subtotalAmount,
    amount_tax: resolution.taxAmount,
    amount_total: resolution.totalAmount,
    amount_received: resolution.paidAmount,
    amount_remaining: balanceAmount,
    terms_version: session.consent?.terms_of_service === "accepted" ? "stripe_payment_link" : "external_payment_link",
    cancellation_policy_version: "stripe_payment_link",
    terms_accepted_at: paidAt.toISOString(),
    user_agent: "stripe_payment_link",
    metadata: {
      source: "stripe_payment_link",
      payment_link: typeof session.payment_link === "string" ? session.payment_link : session.payment_link?.id || null
    },
    paid_at: resolution.paymentOption === "full" ? paidAt.toISOString() : null,
    payment_option: resolution.paymentOption,
    deposit_amount: resolution.paymentOption === "deposit" ? resolution.paidAmount : null,
    balance_amount: resolution.paymentOption === "deposit" ? balanceAmount : 0,
    deposit_status: resolution.paymentOption === "deposit" ? "paid" : "not_applicable",
    balance_status: resolution.paymentOption === "deposit" ? "pending" : "not_applicable",
    deposit_paid_at: resolution.paymentOption === "deposit" ? paidAt.toISOString() : null,
    reminder_at: resolution.paymentOption === "deposit" ? new Date(paidAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString() : null,
    balance_due_at: resolution.paymentOption === "deposit" ? new Date(paidAt.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString() : null,
    public_token_hash: publicToken ? hashPublicToken(publicToken) : null
  };

  const { data, error } = await supabase.from("pilula_orders").insert(order).select("*").single();
  if (error?.code === "23505") {
    const duplicate = await getOrderBySession(session.id);
    return { order: duplicate, publicToken: null, created: false, reason: "duplicate_session" };
  }
  if (error) throw new Error("No se pudo crear la orden desde Payment Link");
  return { order: data as OrderRecord, publicToken, created: true };
}

export async function getOrderByPublicToken(token: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data } = await supabase
    .from("pilula_orders")
    .select("*")
    .eq("public_token_hash", hashPublicToken(token))
    .maybeSingle();
  return (data as OrderRecord | null) || null;
}

export async function markBalanceCheckoutOpen(orderId: string, session: Stripe.Checkout.Session) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  await supabase
    .from("pilula_orders")
    .update({
      stripe_checkout_session_id: session.id,
      stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer?.id || null,
      environment: session.livemode ? "live" : "test",
      livemode: session.livemode,
      updated_at: new Date().toISOString()
    })
    .eq("id", orderId)
    .eq("payment_option", "deposit")
    .eq("balance_status", "pending");
}

export async function markOrderPaidFromPaymentIntent(paymentIntent: Stripe.PaymentIntent, eventId?: string) {
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
      stripe_event_id: eventId || undefined,
      environment: paymentIntent.livemode ? "live" : "test",
      livemode: paymentIntent.livemode,
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

export async function updateOrderStatusFromEvent(sessionId: string, status: "expired" | "failed" | "cancelled", eventId?: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  await supabase
    .from("pilula_orders")
    .update({ status, stripe_event_id: eventId || undefined, updated_at: new Date().toISOString() })
    .eq("stripe_checkout_session_id", sessionId)
    .neq("status", "paid");
}

export async function findAwaitingBankTransferOrder(customerId: string, currency: string, livemode: boolean) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data } = await supabase
    .from("pilula_orders")
    .select("*")
    .eq("stripe_customer_id", customerId)
    .eq("currency", currency)
    .eq("livemode", livemode)
    .in("status", ["awaiting_bank_transfer", "partially_funded"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as OrderRecord | null) || null;
}

export async function updateOrderFunding(order: OrderRecord, amountReceived: number, options: { expired?: boolean; eventId?: string } = {}) {
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
      stripe_event_id: options.eventId || undefined,
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
