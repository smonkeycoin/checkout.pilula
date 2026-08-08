import { beforeEach, describe, expect, it, vi } from "vitest";

const insertSingle = vi.fn();
const insertSelect = vi.fn(() => ({ single: insertSingle }));
const insertedRows: unknown[] = [];
const insert = vi.fn((row: unknown) => {
  insertedRows.push(row);
  return { select: insertSelect };
});
const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle, eq }));
const select = vi.fn(() => ({ eq, maybeSingle }));
const from = vi.fn(() => ({ insert, select }));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({ from })
}));

describe("Payment Link fallback orders", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    insertedRows.length = 0;
    maybeSingle.mockResolvedValue({ data: null });
  });

  it("identifica los cuatro Payment Links LIVE de contingencia", async () => {
    const { resolvePaymentLinkOrder } = await import("@/lib/orders");

    expect(resolvePaymentLinkOrder({ payment_link: "plink_1U1xKiGkqXZguX59hWdHVbuV" } as never)).toMatchObject({
      participantType: "doctor",
      paymentOption: "full",
      totalAmount: 696000
    });
    expect(resolvePaymentLinkOrder({ payment_link: "plink_1U1xKjGkqXZguX59fsVHAQTM" } as never)).toMatchObject({
      participantType: "doctor",
      paymentOption: "deposit",
      paidAmount: 348000
    });
    expect(resolvePaymentLinkOrder({ payment_link: "plink_1U1xKkGkqXZguX597exX33tg" } as never)).toMatchObject({
      participantType: "patient",
      paymentOption: "full",
      totalAmount: 92800
    });
    expect(resolvePaymentLinkOrder({ payment_link: "plink_1U1xKkGkqXZguX59VQ66yTAt" } as never)).toMatchObject({
      participantType: "patient",
      paymentOption: "deposit",
      paidAmount: 46400
    });
  });

  it("crea una orden parcial desde Payment Link de anticipo con token hash y fechas 30/45", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T12:00:00.000Z"));
    insertSingle.mockImplementation(async () => ({ data: insertedRows.at(-1), error: null }));
    const { createOrderFromPaymentLinkSession } = await import("@/lib/orders");

    const result = await createOrderFromPaymentLinkSession(
      {
        id: "cs_live_deposit",
        livemode: true,
        payment_status: "paid",
        payment_link: "plink_1U1xKjGkqXZguX59fsVHAQTM",
        currency: "usd",
        amount_total: 348000,
        customer: "cus_live",
        customer_details: { name: "Yoanna Test", email: "yoanna@example.com", phone: "+5255" },
        payment_intent: "pi_live"
      } as never,
      "evt_live"
    );

    expect(result.created).toBe(true);
    expect(result.publicToken).toBeTruthy();
    expect(result.order).toMatchObject({
      profile_type: "doctor",
      status: "partial",
      payment_option: "deposit",
      amount_total: 696000,
      deposit_amount: 348000,
      balance_amount: 348000,
      amount_received: 348000,
      amount_remaining: 348000,
      deposit_status: "paid",
      balance_status: "pending",
      deposit_paid_at: "2026-08-07T12:00:00.000Z",
      reminder_at: "2026-09-06T12:00:00.000Z",
      balance_due_at: "2026-09-21T12:00:00.000Z",
      livemode: true,
      environment: "live"
    });
    expect(result.order?.public_token_hash).toHaveLength(64);
    expect(result.order?.public_token_hash).not.toBe(result.publicToken);
  });

  it("no duplica una orden si la sesión ya existe", async () => {
    const existing = { id: "order_existing", stripe_checkout_session_id: "cs_existing" };
    maybeSingle.mockResolvedValueOnce({ data: existing });
    const { createOrderFromPaymentLinkSession } = await import("@/lib/orders");

    const result = await createOrderFromPaymentLinkSession(
      {
        id: "cs_existing",
        livemode: true,
        payment_status: "paid",
        payment_link: "plink_1U1xKkGkqXZguX597exX33tg",
        currency: "usd",
        customer_details: {}
      } as never,
      "evt_live"
    );

    expect(result).toMatchObject({ created: false, reason: "order_exists", order: existing });
    expect(insert).not.toHaveBeenCalled();
  });
});
