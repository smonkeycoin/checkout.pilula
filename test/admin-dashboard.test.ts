import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDashboardData, dashboardSupabaseError, rangeStart, type DashboardInput } from "@/lib/admin/dashboard";

const now = new Date("2026-08-03T18:00:00.000Z");

function baseInput(overrides: Partial<DashboardInput> = {}): DashboardInput {
  return {
    range: "30d",
    now,
    orders: [],
    invites: [],
    otps: [],
    invoices: [],
    ...overrides
  };
}

function paidOrder(id: string, currency: "mxn" | "usd", total: number, profile: "doctor" | "patient" = "patient") {
  return {
    id,
    reference: `PILULA-${id}`,
    profile_type: profile,
    status: "paid",
    stripe_checkout_session_id: `cs_${id}`,
    stripe_payment_intent_id: `pi_${id}`,
    stripe_customer_id: `cus_${id}`,
    environment: "live",
    livemode: true,
    is_internal_test: false,
    excluded_from_kpis: false,
    payment_option: "full",
    deposit_amount: null,
    balance_amount: 0,
    deposit_status: "not_applicable",
    balance_status: "not_applicable",
    full_name: "Paciente Test",
    email: "test@example.com",
    phone: "525500000000",
    currency,
    payment_method: "card",
    amount_subtotal: Math.round(total / 1.16),
    amount_tax: total - Math.round(total / 1.16),
    amount_total: total,
    amount_received: total,
    amount_remaining: 0,
    payment_invite_id: `invite-${id}`,
    payment_expires_at: null,
    created_at: "2026-08-02T12:00:00.000Z",
    updated_at: "2026-08-02T12:20:00.000Z",
    paid_at: "2026-08-02T12:20:00.000Z"
  };
}

beforeEach(() => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dashboard");
  vi.stubEnv("STRIPE_TAX_RATE_IVA_16", "txr_test");
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service_role");
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("LEGAL_APPROVED", "false");
});

describe("admin dashboard metrics", () => {
  it("dashboard sin pagos usa estados vacíos y badge Stripe Test", () => {
    const data = buildDashboardData(baseInput());
    expect(data.summary.totalMxn).toBe(0);
    expect(data.summary.totalUsd).toBe(0);
    expect(data.summary.contractedMxn).toBe(0);
    expect(data.summary.cashMxn).toBe(0);
    expect(data.summary.receivableMxn).toBe(0);
    expect(data.summary.orderCount).toBe(0);
    expect(data.summary.paidCustomerCount).toBe(0);
    expect(data.recentPayments).toEqual([]);
    expect(data.integrations.stripe).toBe("test_mode");
  });

  it("calcula un pago MXN sin mezclar monedas", () => {
    const data = buildDashboardData(baseInput({ orders: [paidOrder("mxn", "mxn", 1716800)] }));
    expect(data.summary.totalMxn).toBe(1716800);
    expect(data.summary.contractedMxn).toBe(1716800);
    expect(data.summary.cashMxn).toBe(1716800);
    expect(data.summary.receivableMxn).toBe(0);
    expect(data.summary.totalUsd).toBe(0);
    expect(data.chart.mxn).toEqual([{ date: "2026-08-02", amount: 1716800 }]);
    expect(data.chart.usd).toEqual([]);
  });

  it("calcula un pago USD sin mezclar monedas", () => {
    const data = buildDashboardData(baseInput({ orders: [paidOrder("usd", "usd", 92800)] }));
    expect(data.summary.totalUsd).toBe(92800);
    expect(data.summary.totalMxn).toBe(0);
    expect(data.chart.usd).toEqual([{ date: "2026-08-02", amount: 92800 }]);
  });

  it("excluye pruebas internas y registros fuera de KPIs comerciales", () => {
    const data = buildDashboardData(
      baseInput({
        orders: [
          { ...paidOrder("internal", "mxn", 1716800), is_internal_test: true },
          { ...paidOrder("excluded", "usd", 92800), excluded_from_kpis: true }
        ],
        invites: [
          {
            id: "invite-internal",
            profile_type: "patient",
            status: "paid",
            environment: "live",
            livemode: true,
            is_internal_test: true,
            excluded_from_kpis: false,
            created_at: "2026-08-01T12:00:00.000Z",
            approved_at: "2026-08-01T12:05:00.000Z",
            opened_at: "2026-08-01T12:10:00.000Z",
            expires_at: "2026-08-10T12:00:00.000Z",
            revoked_at: null
          }
        ]
      })
    );
    expect(data.summary.contractedMxn).toBe(0);
    expect(data.summary.contractedUsd).toBe(0);
    expect(data.summary.cashMxn).toBe(0);
    expect(data.summary.cashUsd).toBe(0);
    expect(data.summary.orderCount).toBe(0);
    expect(data.funnel.created).toBe(0);
    expect(data.recentPayments).toEqual([]);
  });

  it("separa venta contratada, cash y saldo por cobrar para anticipos 50/50", () => {
    const data = buildDashboardData(
      baseInput({
        orders: [
          {
            ...paidOrder("doctor-deposit", "usd", 696000, "doctor"),
            status: "partially_paid",
            payment_option: "deposit",
            deposit_amount: 348000,
            balance_amount: 348000,
            deposit_status: "paid",
            balance_status: "pending",
            amount_received: 348000,
            amount_remaining: 348000
          }
        ]
      })
    );
    expect(data.summary.contractedUsd).toBe(696000);
    expect(data.summary.cashUsd).toBe(348000);
    expect(data.summary.receivableUsd).toBe(348000);
    expect(data.summary.depositCount).toBe(1);
    expect(data.summary.fullPaymentCount).toBe(0);
    expect(data.summary.orderCount).toBe(1);
  });

  it("calcula capacidad doctor y paciente desde pagos confirmados", () => {
    const data = buildDashboardData(
      baseInput({ orders: [paidOrder("doctor", "usd", 696000, "doctor"), paidOrder("patient", "mxn", 1716800, "patient")] })
    );
    expect(data.capacity.doctors).toEqual({ confirmed: 1, capacity: 16 });
    expect(data.capacity.patients).toEqual({ confirmed: 1, capacity: 8 });
  });

  it("detecta pendientes SPEI y facturas pendientes", () => {
    const data = buildDashboardData(
      baseInput({
        orders: [
          {
            ...paidOrder("spei", "mxn", 1716800),
            status: "awaiting_bank_transfer",
            payment_method: "bank_transfer",
            amount_received: 0,
            amount_remaining: 1716800
          }
        ],
        invoices: [{ id: "invoice-1", order_id: "order-1", status: "solicitada", created_at: "2026-08-02T12:00:00.000Z" }]
      })
    );
    expect(data.summary.pendingCount).toBe(1);
    expect(data.actionItems.map((item) => item.label)).toContain("SPEI pendiente");
    expect(data.actionItems.map((item) => item.label)).toContain("Factura pendiente");
  });

  it("calcula rangos 7 días y 30 días", () => {
    expect(rangeStart("7d", now)?.toISOString()).toBe("2026-07-27T18:00:00.000Z");
    expect(rangeStart("30d", now)?.toISOString()).toBe("2026-07-04T18:00:00.000Z");
  });

  it("calcula funnel, estados vacíos y gráfica separada por moneda", () => {
    const data = buildDashboardData(
      baseInput({
        orders: [paidOrder("mxn", "mxn", 1716800), paidOrder("usd", "usd", 92800)],
        invites: [
          {
            id: "invite-mxn",
            profile_type: "patient",
            status: "paid",
            created_at: "2026-08-01T12:00:00.000Z",
            approved_at: "2026-08-01T12:05:00.000Z",
            opened_at: "2026-08-01T12:10:00.000Z",
            expires_at: "2026-08-10T12:00:00.000Z",
            revoked_at: null
          },
          {
            id: "invite-expired",
            profile_type: "patient",
            status: "approved",
            created_at: "2026-08-01T12:00:00.000Z",
            approved_at: "2026-08-01T12:05:00.000Z",
            opened_at: null,
            expires_at: "2026-08-02T12:00:00.000Z",
            revoked_at: null
          }
        ],
        otps: [{ invite_id: "invite-mxn", verified_at: "2026-08-01T12:12:00.000Z", created_at: "2026-08-01T12:11:00.000Z" }]
      })
    );
    expect(data.funnel.created).toBe(2);
    expect(data.funnel.otpVerified).toBe(1);
    expect(data.funnel.expired).toBe(1);
    expect(data.chart.mxn[0].amount).toBe(1716800);
    expect(data.chart.usd[0].amount).toBe(92800);
  });

  it("devuelve error seguro para fallos de Supabase", () => {
    expect(dashboardSupabaseError("pilula_orders")).toEqual({
      error: "No se pudo cargar el dashboard administrativo.",
      code: "ADMIN_DASHBOARD_QUERY_FAILED",
      table: "pilula_orders"
    });
  });
});

describe("GET /api/admin/dashboard", () => {
  it("rechaza acceso no autorizado", async () => {
    const { GET } = await import("@/app/api/admin/dashboard/route");
    const response = await GET(new NextRequest("http://localhost:3000/api/admin/dashboard?range=7d"));
    expect(response.status).toBe(401);
  });
});
