import crypto from "node:crypto";
import {
  PLANS,
  type AllowedPaymentMethods,
  type Market,
  type PaymentCurrency,
  type PaymentMethod,
  type PlanKey
} from "@/config/checkout";
import { CANCELLATION_POLICY_VERSION, TERMS_VERSION, termsHash } from "@/config/legal";
import { getEnv } from "@/lib/env";
import { calculateInviteAmounts } from "@/lib/money";
import { canCheckoutInvite } from "@/lib/checkout-guard";
import { PaymentInviteSupabaseError } from "@/lib/admin-invite-errors";
import { sanitizeText } from "@/lib/security/text";
import { createOpaqueToken, hashToken } from "@/lib/security/tokens";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type InviteStatus = "pending" | "approved" | "opened" | "paid" | "expired" | "revoked";

export type PaymentInvite = {
  id: string;
  token_hash: string;
  profile_type: PlanKey;
  status: InviteStatus;
  market: Market;
  full_name: string | null;
  email: string;
  whatsapp: string | null;
  payment_currency: PaymentCurrency;
  currency: PaymentCurrency;
  allowed_payment_methods: AllowedPaymentMethods;
  recommended_payment_method: PaymentMethod;
  stripe_price_id: string | null;
  exchange_rate_mxn_per_usd: string | null;
  exchange_rate_source: string | null;
  exchange_rate_locked_at: string | null;
  base_amount_subtotal_usd: number;
  base_amount_tax_usd: number;
  base_amount_total_usd: number;
  amount_subtotal: number;
  amount_tax: number;
  amount_total: number;
  amount_received: number;
  amount_remaining: number;
  expires_at: string;
  approved_at: string | null;
  opened_at: string | null;
  used_at: string | null;
  revoked_at: string | null;
  terms_version: string;
  terms_hash: string;
  cancellation_policy_version: string;
  stripe_customer_id?: string | null;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
};

export function getPlanPriceIdForInvite(profileType: PlanKey) {
  const env = getEnv();
  return profileType === "doctor" ? env.STRIPE_PRICE_DOCTOR : env.STRIPE_PRICE_PATIENT;
}

export async function getActiveExchangeRate() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("exchange_rates")
    .select("*")
    .eq("status", "active")
    .lte("effective_from", now)
    .or(`effective_until.is.null,effective_until.gte.${now}`)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as { rate: string; source: string | null; effective_until: string | null } | null;
}

export async function buildInviteDefaults(input: {
  profileType: PlanKey;
  market: Market;
  paymentCurrency: PaymentCurrency;
  allowedPaymentMethods: AllowedPaymentMethods;
  exchangeRate?: string | null;
  exchangeRateSource?: string | null;
}) {
  if (input.paymentCurrency === "usd" && input.allowedPaymentMethods !== "card") {
    throw new Error("USD solo permite tarjeta");
  }
  if (input.paymentCurrency !== "mxn" && input.allowedPaymentMethods.includes("bank_transfer")) {
    throw new Error("SPEI requiere MXN");
  }
  const plan = PLANS[input.profileType];
  const activeRate = input.paymentCurrency === "mxn" ? await getActiveExchangeRate() : null;
  const rate = input.paymentCurrency === "mxn" ? input.exchangeRate || activeRate?.rate || null : null;
  const source = input.paymentCurrency === "mxn" ? input.exchangeRateSource || activeRate?.source || "PILULA" : null;
  const amounts = calculateInviteAmounts(input.profileType, input.paymentCurrency, rate);
  const recommended: PaymentMethod =
    input.allowedPaymentMethods === "bank_transfer"
      ? "bank_transfer"
      : input.allowedPaymentMethods === "card"
        ? "card"
        : input.profileType === "doctor"
          ? "bank_transfer"
          : "card";
  return {
    market: input.market,
    payment_currency: input.paymentCurrency,
    currency: input.paymentCurrency,
    allowed_payment_methods: input.allowedPaymentMethods,
    recommended_payment_method: recommended,
    stripe_price_id: input.paymentCurrency === "usd" ? getPlanPriceIdForInvite(input.profileType) : null,
    exchange_rate_mxn_per_usd: rate,
    exchange_rate_source: source,
    exchange_rate_locked_at: input.paymentCurrency === "mxn" ? new Date().toISOString() : null,
    base_amount_subtotal_usd: plan.subtotal,
    base_amount_tax_usd: plan.tax,
    base_amount_total_usd: plan.total,
    amount_subtotal: amounts.amount_subtotal,
    amount_tax: amounts.amount_tax,
    amount_total: amounts.amount_total,
    amount_received: 0,
    amount_remaining: amounts.amount_total,
    terms_version: TERMS_VERSION,
    terms_hash: termsHash(),
    cancellation_policy_version: CANCELLATION_POLICY_VERSION
  };
}

export function createInviteToken() {
  const token = createOpaqueToken();
  return { token, tokenHash: hashToken(token) };
}

export async function createPaymentInvite(input: {
  profileType: PlanKey;
  market: Market;
  paymentCurrency: PaymentCurrency;
  allowedPaymentMethods: AllowedPaymentMethods;
  exchangeRate?: string | null;
  exchangeRateSource?: string | null;
  email: string;
  fullName?: string;
  whatsapp?: string;
  expiresAt?: Date;
  approved?: boolean;
  createdBy?: string;
}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase no esta configurado");

  const env = getEnv();
  const { token, tokenHash } = createInviteToken();
  const expiresAt =
    input.expiresAt || new Date(Date.now() + env.PATIENT_INVITE_TTL_HOURS * 60 * 60 * 1000);
  const defaults = await buildInviteDefaults(input);

  const { data, error } = await supabase
    .from("payment_invites")
    .insert({
      id: crypto.randomUUID(),
      token_hash: tokenHash,
      profile_type: input.profileType,
      status: input.approved ? "approved" : "pending",
      full_name: sanitizeText(input.fullName || "", 180) || null,
      email: sanitizeText(input.email, 180).toLowerCase(),
      whatsapp: sanitizeText(input.whatsapp || "", 40) || null,
      ...defaults,
      expires_at: expiresAt.toISOString(),
      approved_at: input.approved ? new Date().toISOString() : null,
      metadata: {
        created_by: input.createdBy || "system"
      }
    })
    .select("*")
    .single();

  if (error) throw new PaymentInviteSupabaseError(error);
  return { invite: data as PaymentInvite, token };
}

export async function getPaymentInviteByToken(token: string, markOpened = false) {
  const supabase = getSupabaseAdmin();
  const tokenHash = hashToken(token);

  if (!supabase) return { ok: false as const, reason: "not_configured" };

  const { data } = await supabase.from("payment_invites").select("*").eq("token_hash", tokenHash).maybeSingle();
  const invite = data as PaymentInvite | null;
  if (!invite) return { ok: false as const, reason: "invalid" };
  const allowed = canCheckoutInvite(invite);
  if (!allowed.ok) return allowed;

  if (markOpened && invite.status === "approved") {
    await supabase
      .from("payment_invites")
      .update({ status: "opened", opened_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", invite.id)
      .eq("status", "approved");
    invite.status = "opened";
  }

  return { ok: true as const, invite, tokenHash };
}

export async function markPaymentInvitePaid(inviteId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  await supabase
    .from("payment_invites")
    .update({ status: "paid", used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", inviteId)
    .is("used_at", null);
}

export function buildPaymentInviteUrl(token: string) {
  const env = getEnv();
  return `${env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/pagar/${token}`;
}

export function buildWhatsappUrl(invite: Pick<PaymentInvite, "whatsapp" | "full_name">, url: string) {
  const phone = (invite.whatsapp || "").replace(/\D/g, "");
  const text = encodeURIComponent(
    `Hola${invite.full_name ? ` ${invite.full_name}` : ""}, te compartimos tu enlace privado de pago de PÍLULA MedPlanner: ${url}`
  );
  return `https://wa.me/${phone}?text=${text}`;
}
