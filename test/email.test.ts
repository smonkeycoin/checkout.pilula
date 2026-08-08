import { beforeEach, describe, expect, it, vi } from "vitest";

const resendMocks = vi.hoisted(() => ({
  send: vi.fn()
}));

vi.mock("resend", () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: resendMocks.send
    }
  }))
}));

describe("sendResendEmail", () => {
  beforeEach(() => {
    vi.resetModules();
    resendMocks.send.mockReset();
    process.env.RESEND_API_KEY = "re_test";
  });

  it("devuelve sent true cuando Resend devuelve data.id", async () => {
    resendMocks.send.mockResolvedValue({ data: { id: "email_123" }, error: null });
    const { sendResendEmail } = await import("@/lib/email");

    await expect(sendResendEmail({ from: "a@example.com", to: "b@example.com", subject: "x", html: "<p>x</p>" })).resolves.toEqual({
      sent: true,
      emailId: "email_123"
    });
  });

  it("devuelve sent false cuando Resend devuelve error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    resendMocks.send.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "Domain not verified", statusCode: 403 }
    });
    const { sendResendEmail } = await import("@/lib/email");

    await expect(sendResendEmail({ from: "a@example.com", to: "b@example.com", subject: "x", html: "<p>x</p>" })).resolves.toEqual({
      sent: false,
      reason: "resend_error",
      errorCode: "validation_error"
    });
  });

  it("devuelve sent false cuando Resend no devuelve data ni error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    resendMocks.send.mockResolvedValue({ data: null, error: null });
    const { sendResendEmail } = await import("@/lib/email");

    await expect(sendResendEmail({ from: "a@example.com", to: "b@example.com", subject: "x", html: "<p>x</p>" })).resolves.toEqual({
      sent: false,
      reason: "missing_email_id"
    });
  });

  it("envía confirmación de anticipo con link público de saldo", async () => {
    resendMocks.send.mockResolvedValue({ data: { id: "email_deposit" }, error: null });
    process.env.NEXT_PUBLIC_SITE_URL = "https://pagos.pilula.com.mx";
    process.env.EMAIL_FROM = "PILULA <pagos@pilula.com.mx>";
    process.env.EMAIL_REPLY_TO = "info@pilula.com.mx";
    const { sendDepositConfirmationEmail } = await import("@/lib/email");

    const result = await sendDepositConfirmationEmail(
      {
        id: "order_1",
        reference: "PILULA-HTW-TEST",
        profile_type: "doctor",
        status: "partial",
        email: "buyer@example.com",
        currency: "usd",
        amount_subtotal: 600000,
        amount_tax: 96000,
        amount_total: 696000,
        amount_received: 348000,
        amount_remaining: 348000,
        deposit_amount: 348000,
        balance_amount: 348000,
        terms_version: "test"
      },
      "https://pagos.pilula.com.mx/pagar-saldo/public_token_123"
    );

    expect(result).toEqual({ sent: true, emailId: "email_deposit" });
    expect(resendMocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "buyer@example.com",
        subject: "Anticipo confirmado · Hair Transplant Workshop 2026",
        html: expect.stringContaining("https://pagos.pilula.com.mx/pagar-saldo/public_token_123"),
        text: expect.stringContaining("https://pagos.pilula.com.mx/pagar-saldo/public_token_123")
      })
    );
  });

  it("envía invitación comercial de pago completo sin datos técnicos", async () => {
    resendMocks.send.mockResolvedValue({ data: { id: "email_invite_full" }, error: null });
    process.env.NEXT_PUBLIC_SITE_URL = "https://pagos.pilula.com.mx";
    process.env.EMAIL_FROM = "PILULA <pagos@pilula.com.mx>";
    process.env.EMAIL_REPLY_TO = "info@pilula.com.mx";
    const { sendPaymentInviteEmail } = await import("@/lib/email");

    const result = await sendPaymentInviteEmail(
      {
        id: "invite_technical_id",
        token_hash: "hash_never_render",
        profile_type: "patient",
        status: "approved",
        market: "mexico",
        full_name: "Yoanna de la Torre",
        email: "yoanna@example.com",
        whatsapp: null,
        payment_currency: "mxn",
        currency: "mxn",
        allowed_payment_methods: "card_and_bank_transfer",
        recommended_payment_method: "card",
        payment_option: "full",
        stripe_price_id: null,
        exchange_rate_mxn_per_usd: "18.5",
        exchange_rate_source: "admin",
        exchange_rate_locked_at: "2026-08-07T00:00:00.000Z",
        base_amount_subtotal_usd: 80000,
        base_amount_tax_usd: 12800,
        base_amount_total_usd: 92800,
        amount_subtotal: 1480000,
        amount_tax: 236800,
        amount_total: 1716800,
        amount_received: 0,
        amount_remaining: 1716800,
        expires_at: "2026-09-01T00:00:00.000Z",
        approved_at: "2026-08-07T00:00:00.000Z",
        opened_at: null,
        used_at: null,
        revoked_at: null,
        terms_version: "test",
        terms_hash: "terms_hash",
        cancellation_policy_version: "test",
        metadata: { created_by: "admin@example.com", internal_note: "do-not-render" }
      },
      "https://pagos.pilula.com.mx/pagar/private_token"
    );

    expect(result).toEqual({ sent: true, emailId: "email_invite_full" });
    expect(resendMocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "yoanna@example.com",
        subject: "Tu enlace privado de pago · Hair Transplant Workshop 2026",
        html: expect.stringContaining("Hola, Yoanna"),
        text: expect.stringContaining("Puedes completar tu inscripción desde tu enlace privado.")
      })
    );
    const payload = resendMocks.send.mock.calls[0][0];
    expect(payload.html).toContain("Tu invitación para Hair Transplant Workshop 2026 fue aprobada.");
    expect(payload.html).toContain("Abrir enlace privado");
    expect(payload.html).toContain("Este enlace es personal y está asociado a tu invitación.");
    expect(payload.html).toContain("El pago se procesa de forma segura con Stripe. No compartas este enlace.");
    expect(payload.html).not.toContain("invite_technical_id");
    expect(payload.html).not.toContain("hash_never_render");
    expect(payload.html).not.toContain("created_by");
    expect(payload.html).not.toContain("do-not-render");
    expect(payload.html).not.toContain("order_id");
  });

  it("usa saludo genérico y detalles 50% cuando el nombre parece prueba interna", async () => {
    resendMocks.send.mockResolvedValue({ data: { id: "email_invite_deposit" }, error: null });
    process.env.EMAIL_FROM = "PILULA <pagos@pilula.com.mx>";
    process.env.EMAIL_REPLY_TO = "info@pilula.com.mx";
    const { sendPaymentInviteEmail } = await import("@/lib/email");

    await sendPaymentInviteEmail(
      {
        id: "invite_123",
        token_hash: "hash_never_render",
        profile_type: "patient",
        status: "approved",
        market: "mexico",
        full_name: "Prueba interna Chrome anticipo 1786157013198",
        email: "cliente@example.com",
        whatsapp: null,
        payment_currency: "mxn",
        currency: "mxn",
        allowed_payment_methods: "card_and_bank_transfer",
        recommended_payment_method: "card",
        payment_option: "deposit",
        stripe_price_id: null,
        exchange_rate_mxn_per_usd: "18.5",
        exchange_rate_source: "admin",
        exchange_rate_locked_at: "2026-08-07T00:00:00.000Z",
        base_amount_subtotal_usd: 80000,
        base_amount_tax_usd: 12800,
        base_amount_total_usd: 92800,
        amount_subtotal: 1480000,
        amount_tax: 236800,
        amount_total: 1716800,
        amount_received: 0,
        amount_remaining: 1716800,
        expires_at: "2026-09-01T00:00:00.000Z",
        approved_at: "2026-08-07T00:00:00.000Z",
        opened_at: null,
        used_at: null,
        revoked_at: null,
        terms_version: "test",
        terms_hash: "terms_hash",
        cancellation_policy_version: "test"
      },
      "https://pagos.pilula.com.mx/pagar/private_token"
    );

    const payload = resendMocks.send.mock.calls[0][0];
    expect(payload.html).toContain("<p>Hola</p>");
    expect(payload.html).not.toContain("Prueba interna");
    expect(payload.html).not.toContain("1786157013198");
    expect(payload.html).toContain("Puedes apartar tu lugar pagando el 50% ahora.");
    expect(payload.html).toContain("<strong>Pago inicial:</strong> 50%");
    expect(payload.html).toContain("<strong>Saldo:</strong> 50%");
    expect(payload.html).toContain("<strong>Plazo para liquidar:</strong> 45 días después de tu anticipo");
    expect(payload.text).toContain("Pago inicial: 50%");
    expect(payload.text).toContain("Saldo: 50%");
    expect(payload.text).toContain("Plazo para liquidar: 45 días después de tu anticipo");
  });
});
