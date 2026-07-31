import { z } from "zod";
import type { AllowedPaymentMethods, PaymentMethod, PlanKey } from "@/config/checkout";
import type { PaymentInvite } from "@/lib/payment-invites";

export const checkoutInputSchema = z
  .object({
    inviteToken: z.string().min(20).max(256),
    termsAccepted: z.literal(true),
    totalAccepted: z.literal(true),
    paymentMethod: z.enum(["card", "bank_transfer"]),
    plan: z.enum(["doctor", "patient"]).optional(),
    website: z.string().max(0).optional()
  })
  .strict();

export function validateCheckoutPayload(payload: unknown) {
  return checkoutInputSchema.safeParse(payload);
}

export function isPaymentMethodAllowed(allowed: AllowedPaymentMethods, method: PaymentMethod) {
  return allowed === method || allowed === "card_and_bank_transfer";
}

export function canCheckoutInvite(
  invite: Pick<
    PaymentInvite,
    "status" | "expires_at" | "used_at" | "revoked_at" | "profile_type" | "allowed_payment_methods" | "payment_currency"
  >,
  requestedPlan?: PlanKey,
  requestedMethod?: PaymentMethod
) {
  if (invite.revoked_at || invite.status === "revoked") return { ok: false as const, reason: "revoked" };
  if (invite.used_at || invite.status === "paid") return { ok: false as const, reason: "used" };
  if (new Date(invite.expires_at).getTime() <= Date.now()) return { ok: false as const, reason: "expired" };
  if (invite.status !== "approved" && invite.status !== "opened") return { ok: false as const, reason: "not_approved" };
  if (requestedPlan && requestedPlan !== invite.profile_type) return { ok: false as const, reason: "profile_mismatch" };
  if (requestedMethod && !isPaymentMethodAllowed(invite.allowed_payment_methods, requestedMethod)) {
    return { ok: false as const, reason: "payment_method_not_allowed" };
  }
  if (requestedMethod === "bank_transfer" && invite.payment_currency !== "mxn") {
    return { ok: false as const, reason: "bank_transfer_requires_mxn" };
  }
  return { ok: true as const };
}
