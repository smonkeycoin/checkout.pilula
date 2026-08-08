import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyAdminRequest: vi.fn(),
  createPaymentInvite: vi.fn(),
  sendPaymentInviteEmail: vi.fn()
}));

vi.mock("@/lib/admin-auth", () => ({
  adminUnauthorizedBody: (reason: string) => ({ error: "No autorizado", reason }),
  verifyAdminRequest: mocks.verifyAdminRequest
}));

vi.mock("@/lib/payment-invites", () => ({
  buildPaymentInviteUrl: (token: string) => `https://pagos.pilula.com.mx/pagar/${token}`,
  buildWhatsappUrl: () => "https://wa.me/525500000000",
  createPaymentInvite: mocks.createPaymentInvite
}));

vi.mock("@/lib/email", () => ({
  sendPaymentInviteEmail: mocks.sendPaymentInviteEmail
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(() => null)
}));

function request(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/admin/invites", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" }
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    profileType: "patient",
    market: "mexico",
    paymentCurrency: "mxn",
    allowedPaymentMethods: "card_and_bank_transfer",
    paymentOption: "deposit",
    exchangeRate: "18.5",
    fullName: "Dra Test",
    email: "yoanna@example.com",
    whatsapp: "525500000000",
    expiresAt: "2026-08-15T12:00:00.000Z",
    approved: true,
    sendEmail: false,
    ...overrides
  };
}

beforeEach(() => {
  mocks.verifyAdminRequest.mockResolvedValue({ ok: true, email: "pilulamedplanner@gmail.com" });
  mocks.createPaymentInvite.mockResolvedValue({
    invite: {
      id: "invite_123",
      full_name: "Dra Test",
      email: "yoanna@example.com",
      profile_type: "patient",
      payment_option: "deposit",
      amount_total: 1716800,
      currency: "mxn"
    },
    token: "token_123"
  });
  mocks.sendPaymentInviteEmail.mockResolvedValue({ sent: true, emailId: "email_123" });
});

describe("POST /api/admin/invites", () => {
  it("recibe paymentOption deposit", async () => {
    const { POST } = await import("@/app/api/admin/invites/route");

    const response = await POST(request(validBody()));

    expect(response.status).toBe(200);
    expect(mocks.createPaymentInvite).toHaveBeenCalledWith(expect.objectContaining({ paymentOption: "deposit" }));
  });

  it("devuelve 400 con mensaje útil ante validación", async () => {
    const { POST } = await import("@/app/api/admin/invites/route");

    const response = await POST(request(validBody({ email: "invalid" })));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: "Captura un correo válido.", code: "INVITE_VALIDATION_FAILED" });
  });

  it("crea invitación aunque Resend falle", async () => {
    mocks.sendPaymentInviteEmail.mockResolvedValueOnce({ sent: false, reason: "resend_error", errorCode: "validation_error" });
    const { POST } = await import("@/app/api/admin/invites/route");

    const response = await POST(request(validBody({ sendEmail: true })));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.url).toBe("https://pagos.pilula.com.mx/pagar/token_123");
    expect(payload.email).toEqual({
      requested: true,
      sent: false,
      reason: "resend_error",
      errorCode: "validation_error"
    });
  });
});
