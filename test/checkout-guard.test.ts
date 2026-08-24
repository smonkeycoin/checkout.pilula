import { describe, expect, it } from "vitest";
import { canCheckoutInvite, validateCheckoutPayload } from "@/lib/checkout-guard";
import type { PaymentInvite } from "@/lib/payment-invites";

function invite(overrides: Partial<PaymentInvite> = {}): PaymentInvite {
  const base: PaymentInvite = {
    id: "11111111-1111-1111-1111-111111111111",
    token_hash: "hash",
    profile_type: "doctor",
    status: "approved",
    market: "mexico",
    full_name: "Nombre",
    email: "test@example.com",
    whatsapp: null,
    payment_currency: "mxn",
    currency: "mxn",
    allowed_payment_methods: "card_and_bank_transfer",
    recommended_payment_method: "bank_transfer",
    stripe_price_id: null,
    exchange_rate_mxn_per_usd: "18.50",
    exchange_rate_source: "test",
    exchange_rate_locked_at: new Date().toISOString(),
    base_amount_subtotal_usd: 600000,
    base_amount_tax_usd: 96000,
    base_amount_total_usd: 696000,
    amount_subtotal: 11100000,
    amount_tax: 1776000,
    amount_total: 12876000,
    amount_received: 0,
    amount_remaining: 12876000,
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
    approved_at: new Date().toISOString(),
    opened_at: null,
    used_at: null,
    revoked_at: null,
    terms_version: "2026-01",
    terms_hash: "test",
    cancellation_policy_version: "2026-01"
  };
  return { ...base, ...overrides };
}

describe("checkout privado por invitacion", () => {
  it("rechaza pago publico sin token", () => {
    expect(validateCheckoutPayload({ termsAccepted: true, totalAccepted: true }).success).toBe(false);
  });

  it("acepta invitacion Doctor valida", () => {
    expect(canCheckoutInvite(invite({ profile_type: "doctor" }), "doctor")).toEqual({ ok: true });
  });

  it("acepta invitacion Paciente valida", () => {
    expect(canCheckoutInvite(invite({ profile_type: "patient" }), "patient", "card")).toEqual({ ok: true });
  });

  it("rechaza token vencido", () => {
    expect(canCheckoutInvite(invite({ expires_at: new Date(Date.now() - 1000).toISOString() }))).toEqual({
      ok: false,
      reason: "expired"
    });
  });

  it("rechaza token revocado", () => {
    expect(canCheckoutInvite(invite({ status: "revoked" }))).toEqual({ ok: false, reason: "revoked" });
  });

  it("rechaza token usado", () => {
    expect(canCheckoutInvite(invite({ status: "paid" }))).toEqual({ ok: false, reason: "used" });
  });

  it("rechaza cambio de modalidad", () => {
    expect(canCheckoutInvite(invite({ profile_type: "doctor" }), "patient")).toEqual({
      ok: false,
      reason: "profile_mismatch"
    });
  });

  it("rechaza Price ID enviado por cliente", () => {
    expect(
      validateCheckoutPayload({
        inviteToken: "a".repeat(24),
        termsAccepted: true,
        totalAccepted: true,
        paymentMethod: "card",
        priceId: "price_malicioso"
      }).success
    ).toBe(false);
  });

  it("rechaza descuento enviado por cliente", () => {
    expect(
      validateCheckoutPayload({
        inviteToken: "a".repeat(24),
        termsAccepted: true,
        totalAccepted: true,
        paymentMethod: "card",
        discountPercent: 90
      }).success
    ).toBe(false);
  });

  it("rechaza SPEI cuando la invitacion es USD", () => {
    expect(canCheckoutInvite(invite({ payment_currency: "usd", currency: "usd" }), "doctor", "bank_transfer")).toEqual({
      ok: false,
      reason: "bank_transfer_requires_mxn"
    });
  });
});
