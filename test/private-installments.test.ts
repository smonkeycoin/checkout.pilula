import { describe, expect, it, vi } from "vitest";
import { buildInitialOrderFinancials, buildPaidOrderFinancials, getCheckoutChargeAmounts } from "@/lib/order-financials";

type CapturedCheckoutParams = {
  line_items: Array<{ price_data: { unit_amount: number }; tax_rates?: string[] }>;
  metadata: Record<string, string>;
};

describe("private invite installments", () => {
  it("calcula contrato, anticipo y saldo con el mismo modelo financiero", () => {
    const amounts = { amount_subtotal: 600000, amount_tax: 96000, amount_total: 696000 };

    expect(getCheckoutChargeAmounts("deposit", amounts)).toEqual({
      amount_subtotal: 300000,
      amount_tax: 48000,
      amount_total: 348000
    });
    expect(buildInitialOrderFinancials("deposit", amounts)).toMatchObject({
      payment_option: "deposit",
      total_amount: 696000,
      deposit_amount: 348000,
      balance_amount: 348000,
      amount_paid: 0,
      amount_due: 696000,
      deposit_status: "pending",
      balance_status: "pending"
    });
    expect(buildPaidOrderFinancials("deposit", amounts, new Date("2026-08-07T12:00:00.000Z"))).toMatchObject({
      payment_option: "deposit",
      total_amount: 696000,
      deposit_amount: 348000,
      balance_amount: 348000,
      amount_paid: 348000,
      amount_due: 348000,
      amount_received: 348000,
      amount_remaining: 348000,
      deposit_status: "paid",
      balance_status: "pending",
      reminder_at: "2026-09-06T12:00:00.000Z",
      balance_due_at: "2026-09-21T12:00:00.000Z"
    });
  });

  it("calcula pago completo sin saldo pendiente", () => {
    const amounts = { amount_subtotal: 80000, amount_tax: 12800, amount_total: 92800 };
    expect(buildPaidOrderFinancials("full", amounts, new Date("2026-08-07T12:00:00.000Z"))).toMatchObject({
      payment_option: "full",
      total_amount: 92800,
      deposit_amount: null,
      balance_amount: 0,
      amount_paid: 92800,
      amount_due: 0,
      deposit_status: "not_applicable",
      balance_status: "not_applicable"
    });
  });
});

describe("private invite checkout session", () => {
  it("cobra solo 50% en una invitación privada con anticipo", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://pagos.pilula.com.mx");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    vi.stubEnv("STRIPE_TAX_RATE_IVA_16", "txr_test");
    vi.stubEnv("STRIPE_PRICE_DOCTOR", "price_doctor");
    vi.stubEnv("STRIPE_PRICE_PATIENT", "price_patient");

    let capturedParams: CapturedCheckoutParams | undefined;
    const create = vi.fn(async (params) => {
      capturedParams = params as CapturedCheckoutParams;
      return { id: "cs_123", url: "https://checkout.stripe.test" };
    });
    vi.doMock("@/lib/stripe/client", () => ({
      getStripe: () => ({
        checkout: {
          sessions: { create }
        }
      })
    }));
    vi.doMock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => null }));

    const { createCheckoutSession } = await import("@/lib/stripe/checkout-session");
    await createCheckoutSession({
      plan: "doctor",
      order: {
        id: "order_1",
        reference: "PILULA-HTW-TEST",
        profile_type: "doctor",
        status: "created",
        currency: "usd",
        amount_subtotal: 600000,
        amount_tax: 96000,
        amount_total: 696000,
        terms_version: "test"
      },
      invite: {
        id: "invite_1",
        token_hash: "hash",
        profile_type: "doctor",
        status: "approved",
        market: "mexico",
        full_name: "Yoanna",
        email: "yoanna@example.com",
        whatsapp: null,
        payment_currency: "usd",
        currency: "usd",
        allowed_payment_methods: "card",
        recommended_payment_method: "card",
        payment_option: "deposit",
        stripe_price_id: "price_doctor",
        exchange_rate_mxn_per_usd: null,
        exchange_rate_source: null,
        exchange_rate_locked_at: null,
        base_amount_subtotal_usd: 600000,
        base_amount_tax_usd: 96000,
        base_amount_total_usd: 696000,
        amount_subtotal: 600000,
        amount_tax: 96000,
        amount_total: 696000,
        amount_received: 0,
        amount_remaining: 696000,
        expires_at: "2026-08-14T12:00:00.000Z",
        approved_at: "2026-08-07T12:00:00.000Z",
        opened_at: null,
        used_at: null,
        revoked_at: null,
        terms_version: "2026-01",
        terms_hash: "hash",
        cancellation_policy_version: "2026-01"
      },
      paymentMethod: "card"
    });

    if (!capturedParams) throw new Error("missing checkout params");
    const params = capturedParams;
    expect(params.line_items[0].price_data.unit_amount).toBe(300000);
    expect(params.line_items[0].tax_rates).toEqual(["txr_test"]);
    expect(params.metadata).toMatchObject({
      payment_option: "deposit",
      contract_amount_subtotal: "600000",
      contract_amount_tax: "96000",
      contract_amount_total: "696000"
    });
  });
});
