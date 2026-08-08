import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminFetch: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  signInWithOAuth: vi.fn(),
  signInWithOtp: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(async () => ({ data: { session: { access_token: "access_123" } } }))
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
      getSession: mocks.getSession,
      signInWithOAuth: mocks.signInWithOAuth,
      signInWithOtp: mocks.signInWithOtp,
      signOut: mocks.signOut
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
      contractedMxn: 1716800,
      contractedUsd: 0,
      cashMxn: 1716800,
      cashUsd: 0,
      receivableMxn: 0,
      receivableUsd: 0,
      depositCount: 0,
      fullPaymentCount: 1,
      orderCount: 1,
      paidCustomerCount: 1,
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

function invitePayload(overrides: Record<string, unknown> = {}) {
  return {
    invite: {
      id: "invite_123",
      full_name: "Dra Test",
      email: "yoanna@example.com",
      profile_type: "patient",
      payment_option: "full",
      amount_total: 1716800,
      currency: "mxn",
      ...overrides
    },
    url: "https://pagos.pilula.com.mx/pagar/token_123",
    email: { requested: false, sent: false }
  };
}

function mockInviteRequests(postResponses: Response[] = []) {
  const posts = [...postResponses];
  mocks.adminFetch.mockImplementation(async (_input: string, init?: { method?: string }) => {
    if (init?.method === "POST") {
      return posts.shift() || new Response(JSON.stringify(invitePayload()), { status: 200 });
    }
    return new Response(JSON.stringify({ invites: [] }), { status: 200 });
  });
}

function postCalls() {
  return mocks.adminFetch.mock.calls.filter(([, init]) => (init as { method?: string } | undefined)?.method === "POST");
}

beforeEach(() => {
  mocks.adminFetch.mockReset();
  mocks.push.mockReset();
  mocks.replace.mockReset();
  mocks.signInWithOAuth.mockReset();
  mocks.signInWithOAuth.mockResolvedValue({ error: null });
  mocks.signInWithOtp.mockReset();
  mocks.signOut.mockReset();
  mocks.getSession.mockReset();
  mocks.getSession.mockResolvedValue({ data: { session: { access_token: "access_123" } } });
});

describe("admin components", () => {
  it("login admin usa solo Google OAuth y elimina magic link", async () => {
    const { AdminLogin } = await import("@/app/admin/AdminClient");

    render(<AdminLogin />);

    expect(screen.getByRole("button", { name: "Continuar con Google" })).toBeInTheDocument();
    expect(screen.queryByText("Respaldo")).not.toBeInTheDocument();
    expect(screen.queryByText("Magic link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar magic link" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continuar con Google" }));

    await waitFor(() =>
      expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: "http://localhost:3000/auth/callback"
        }
      })
    );
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
  });

  it("dashboard carga con sesión", async () => {
    mocks.adminFetch.mockResolvedValueOnce(new Response(JSON.stringify(dashboardPayload()), { status: 200 }));
    const { DashboardAdmin } = await import("@/app/admin/AdminClient");

    render(<DashboardAdmin initialRange="30d" />);

    await waitFor(() => expect(screen.getByText("Ventas contratadas MXN")).toBeInTheDocument());
    expect(screen.getByText("Cash cobrado MXN")).toBeInTheDocument();
    expect(screen.getByText("Saldo por cobrar MXN")).toBeInTheDocument();
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

  it("muestra validación visible y no bloquea por required invisible", async () => {
    mockInviteRequests();
    const { InvitationsAdmin } = await import("@/app/admin/AdminClient");

    render(<InvitationsAdmin />);
    fireEvent.click(screen.getByRole("button", { name: "Crear invitación" }));

    expect(await screen.findByText("Captura el nombre.")).toBeInTheDocument();
    expect(screen.getByText("Captura un correo válido.")).toBeInTheDocument();
    expect(screen.queryByText("Tipo de cambio requerido")).not.toBeInTheDocument();
    expect(mocks.adminFetch).not.toHaveBeenCalledWith("/api/admin/invites", expect.objectContaining({ method: "POST" }));
  });

  it("crea invitación de pago completo desde submit", async () => {
    mockInviteRequests([new Response(JSON.stringify(invitePayload()), { status: 200 })]);
    const { InvitationsAdmin } = await import("@/app/admin/AdminClient");

    render(<InvitationsAdmin />);
    fireEvent.change(screen.getByLabelText("Participante"), { target: { value: "patient" } });
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Dra Test" } });
    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "yoanna@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear invitación" }));

    await waitFor(() => expect(screen.getByText("Invitación creada.")).toBeInTheDocument());
    expect(screen.getAllByText("Pago completo").length).toBeGreaterThan(0);
    expect(postCalls()).toHaveLength(1);
    expect(postCalls()[0]).toEqual([
      "/api/admin/invites",
      expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({ paymentOption: "full", fullName: "Dra Test", email: "yoanna@example.com" })
      })
    ]);
  });

  it("crea invitación de anticipo 50%", async () => {
    mockInviteRequests([new Response(JSON.stringify(invitePayload({ payment_option: "deposit" })), { status: 200 })]);
    const { InvitationsAdmin } = await import("@/app/admin/AdminClient");

    render(<InvitationsAdmin />);
    fireEvent.change(screen.getByLabelText("Modalidad"), { target: { value: "deposit" } });
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Dra Test" } });
    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "yoanna@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear invitación" }));

    await waitFor(() => expect(screen.getByText("Anticipo 50%")).toBeInTheDocument());
    expect(postCalls()).toHaveLength(1);
    expect(postCalls()[0]).toEqual([
      "/api/admin/invites",
      expect.objectContaining({ body: expect.objectContaining({ paymentOption: "deposit" }) })
    ]);
  });

  it("muestra error de API de tipo de cambio", async () => {
    mockInviteRequests([
      new Response(JSON.stringify({ error: "Falta la tasa MXN para crear la invitación.", code: "INVITE_MXN_RATE_MISSING" }), { status: 400 })
    ]);
    const { InvitationsAdmin } = await import("@/app/admin/AdminClient");

    render(<InvitationsAdmin />);
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Dra Test" } });
    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "yoanna@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear invitación" }));

    expect(await screen.findByText("Falta la tasa MXN para crear la invitación.")).toBeInTheDocument();
  });

  it("conserva link cuando Resend falla", async () => {
    mockInviteRequests([
        new Response(
          JSON.stringify({
            ...invitePayload(),
            email: { requested: true, sent: false, reason: "resend_error" }
          }),
          { status: 200 }
        )
    ]);
    const { InvitationsAdmin } = await import("@/app/admin/AdminClient");

    render(<InvitationsAdmin />);
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Dra Test" } });
    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "yoanna@example.com" } });
    fireEvent.click(screen.getByLabelText("Enviar email con Resend"));
    fireEvent.click(screen.getByRole("button", { name: "Crear invitación" }));

    expect(await screen.findByText("Invitación creada, pero el correo no pudo enviarse.")).toBeInTheDocument();
    expect(screen.getByText("https://pagos.pilula.com.mx/pagar/token_123")).toBeInTheDocument();
  });

  it("evita double tap mientras está creando", async () => {
    let resolvePost: (response: Response) => void = () => undefined;
    mocks.adminFetch.mockImplementation(async (_input: string, init?: { method?: string }) => {
      if (init?.method === "POST") return new Promise<Response>((resolve) => { resolvePost = resolve; });
      return new Response(JSON.stringify({ invites: [] }), { status: 200 });
    });
    const { InvitationsAdmin } = await import("@/app/admin/AdminClient");

    render(<InvitationsAdmin />);
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Dra Test" } });
    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "yoanna@example.com" } });
    const button = screen.getByRole("button", { name: "Crear invitación" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(await screen.findByRole("button", { name: "Creando invitación..." })).toBeDisabled();
    expect(postCalls()).toHaveLength(1);
    resolvePost(new Response(JSON.stringify(invitePayload()), { status: 200 }));
    await waitFor(() => expect(screen.getByText("Invitación creada.")).toBeInTheDocument());
  });

  it("permite copiar link creado", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    mockInviteRequests([new Response(JSON.stringify(invitePayload()), { status: 200 })]);
    const { InvitationsAdmin } = await import("@/app/admin/AdminClient");

    render(<InvitationsAdmin />);
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Dra Test" } });
    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "yoanna@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear invitación" }));
    fireEvent.click(await screen.findByRole("button", { name: "Copiar link" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("https://pagos.pilula.com.mx/pagar/token_123"));
    expect(screen.getByText("Link copiado")).toBeInTheDocument();
  });

  it("formatea fecha de expiración sin ISO crudo en tabla", async () => {
    mocks.adminFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          invites: [
            {
              id: "invite_date",
              full_name: "Paciente Fecha",
              email: "fecha@example.com",
              profile_type: "patient",
              payment_option: "full",
              status: "approved",
              expires_at: "2026-08-15T07:42:00+00:00"
            }
          ]
        }),
        { status: 200 }
      )
    );
    const { InvitationsAdmin } = await import("@/app/admin/AdminClient");

    render(<InvitationsAdmin />);

    await waitFor(() => expect(screen.getByText("Paciente Fecha")).toBeInTheDocument());
    expect(screen.queryByText("2026-08-15T07:42:00+00:00")).not.toBeInTheDocument();
    expect(screen.getByText((content) => content.includes("2026") && content.includes("ago"))).toBeInTheDocument();
  });
});
