import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import type { PaymentInvite } from "@/lib/payment-invites";

const mocks = vi.hoisted(() => ({
  createOrderFromInvite: vi.fn()
}));

const validInvite = vi.hoisted<PaymentInvite>(() => ({
  id: "11111111-1111-1111-1111-111111111111",
  token_hash: "hash",
  profile_type: "doctor",
  status: "approved",
  market: "mexico",
  full_name: "Nombre",
  email: "trinopc1@gmail.com",
  whatsapp: null,
  payment_currency: "mxn",
  currency: "mxn",
  allowed_payment_methods: "card_and_bank_transfer",
  recommended_payment_method: "card",
  stripe_price_id: null,
  exchange_rate_mxn_per_usd: "18.50",
  exchange_rate_source: "admin",
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
  terms_hash: "hash",
  cancellation_policy_version: "2026-01"
}));

vi.mock("@/lib/payment-invites", () => ({
  getPaymentInviteByToken: vi.fn(async () => ({ ok: true, invite: validInvite }))
}));

vi.mock("@/lib/payment-invite-otp", () => ({
  isInviteOtpVerified: vi.fn(() => false)
}));

vi.mock("@/lib/orders", () => ({
  createOrderFromInvite: mocks.createOrderFromInvite,
  markOrderCheckoutOpen: vi.fn()
}));

vi.mock("@/lib/stripe/checkout-session", () => ({
  createCheckoutSession: vi.fn()
}));

vi.mock("@/lib/email", () => ({
  sendBankTransferInstructionsEmail: vi.fn()
}));

describe("checkout OTP server guard", () => {
  it("rechaza checkout sin OTP verificado", async () => {
    mocks.createOrderFromInvite.mockClear();
    const { POST } = await import("@/app/api/checkout/route");
    const request = new NextRequest("http://localhost:3000/api/checkout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000"
      },
      body: JSON.stringify({
        inviteToken: "a".repeat(32),
        termsAccepted: true,
        totalAccepted: true,
        paymentMethod: "card"
      })
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toMatch(/verifica tu correo/i);
    expect(mocks.createOrderFromInvite).not.toHaveBeenCalled();
  });
});
