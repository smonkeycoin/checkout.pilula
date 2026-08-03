import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminFetch: vi.fn(),
  push: vi.fn(),
  replace: vi.fn()
}));

vi.mock("@/lib/admin-api-client", () => ({
  AdminAuthError: class AdminAuthError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
  adminFetch: mocks.adminFetch,
  downloadAdminCsv: vi.fn()
}));

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { access_token: "access_123" } } })),
      signOut: vi.fn()
    }
  }))
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({
    push: mocks.push,
    replace: mocks.replace
  })
}));

function dashboardPayload() {
  return {
    range: "30d",
    generatedAt: "2026-08-03T18:00:00.000Z",
    lastDataAt: "2026-08-03T18:00:00.000Z",
    summary: {
      totalMxn: 1716800,
      totalUsd: 0,
      paidCount: 1,
      pendingCount: 0,
      doctorsConfirmed: 0,
      patientsConfirmed: 1
    },
    capacity: {
      doctors: { confirmed: 0, capacity: 16 },
      patients: { confirmed: 1, capacity: 8 }
    },
    funnel: {
      created: 1,
      approved: 1,
      opened: 1,
      otpVerified: 1,
      checkoutStarted: 1,
      paid: 1,
      expired: 0,
      revoked: 0,
      conversionRate: 1
    },
    recentPayments: [],
    actionItems: [],
    activity: [],
    paymentMethods: {
      card: { count: 1, mxn: 1716800, usd: 0 },
      spei: { count: 0, mxn: 0, usd: 0 },
      currency: { mxn: { count: 1, amount: 1716800 }, usd: { count: 0, amount: 0 } }
    },
    integrations: {
      stripe: "test_mode",
      supabase: "operational",
      resend: "operational",
      legal: "legal_pending"
    },
    chart: {
      mxn: [{ date: "2026-08-03", amount: 1716800 }],
      usd: []
    },
    measurementNotes: {
      activity: "Actividad derivada de timestamps existentes.",
      funnel: "OTP verificado se mide por payment_invite_otps."
    }
  };
}

describe("admin components", () => {
  it("dashboard carga con sesión", async () => {
    mocks.adminFetch.mockResolvedValueOnce(new Response(JSON.stringify(dashboardPayload()), { status: 200 }));
    const { DashboardAdmin } = await import("@/app/admin/AdminClient");

    render(<DashboardAdmin initialRange="30d" />);

    await waitFor(() => expect(screen.getByText("Cobrado total MXN")).toBeInTheDocument());
    expect(screen.getAllByText("MXN 17,168.00").length).toBeGreaterThan(0);
    expect(screen.getByText("1 / 8")).toBeInTheDocument();
    expect(mocks.adminFetch).toHaveBeenCalledWith("/api/admin/dashboard?range=30d");
  });

  it("pagos carga con sesión", async () => {
    mocks.adminFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          payments: [
            {
              id: "order_1",
              reference: "PILULA-HTW-20260803-EE5750",
              status: "paid",
              currency: "mxn",
              payment_method: "card",
              amount_total: 1716800
            }
          ]
        }),
        { status: 200 }
      )
    );
    const { AdminData } = await import("@/app/admin/AdminClient");

    render(<AdminData endpoint="/api/admin/payments" csvPath="/api/admin/payments?format=csv" label="pagos" />);

    await waitFor(() => expect(screen.getByText("PILULA-HTW-20260803-EE5750")).toBeInTheDocument());
    expect(mocks.adminFetch).toHaveBeenCalledWith("/api/admin/payments");
  });
});
