import fs from "node:fs";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
  signOut: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  pathname: "/admin/pagos"
}));

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: vi.fn(() => ({
    auth: {
      getSession: mocks.getSession,
      refreshSession: mocks.refreshSession,
      signOut: mocks.signOut
    }
  }))
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({
    push: mocks.push,
    replace: mocks.replace
  })
}));

function response(status: number, body: unknown = { ok: true }) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function session(token: string) {
  return { data: { session: { access_token: token } } };
}

beforeEach(() => {
  mocks.getSession.mockReset();
  mocks.refreshSession.mockReset();
  mocks.signOut.mockReset();
  mocks.push.mockReset();
  mocks.replace.mockReset();
  vi.stubGlobal("fetch", vi.fn(async () => response(200)));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("adminFetch", () => {
  it("añade Bearer token", async () => {
    mocks.getSession.mockResolvedValue(session("access_123"));
    const { adminFetch } = await import("@/lib/admin-api-client");

    await adminFetch("/api/admin/dashboard");

    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer access_123");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(init.credentials).toBe("same-origin");
  });

  it("sin sesión lanza NO_SESSION", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    const { AdminAuthError, adminFetch } = await import("@/lib/admin-api-client");

    await expect(adminFetch("/api/admin/dashboard")).rejects.toMatchObject(new AdminAuthError("NO_SESSION"));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("401 refresca una sola vez y repite con nuevo access token", async () => {
    mocks.getSession.mockResolvedValue(session("old_token"));
    mocks.refreshSession.mockResolvedValue(session("new_token"));
    vi.stubGlobal("fetch", vi.fn(async () => (vi.mocked(fetch).mock.calls.length === 1 ? response(401) : response(200))));
    const { adminFetch } = await import("@/lib/admin-api-client");

    const result = await adminFetch("/api/admin/payments");

    expect(result.status).toBe(200);
    expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    const retryInit = vi.mocked(fetch).mock.calls[1][1] as RequestInit;
    expect(new Headers(retryInit.headers).get("Authorization")).toBe("Bearer new_token");
  });

  it("segundo 401 cierra sesión y redirige a login", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign }
    });
    mocks.getSession.mockResolvedValue(session("old_token"));
    mocks.refreshSession.mockResolvedValue(session("new_token"));
    vi.stubGlobal("fetch", vi.fn(async () => response(401, { error: "No autorizado", reason: "invalid_token" })));
    const { adminFetch } = await import("@/lib/admin-api-client");

    await expect(adminFetch("/api/admin/invoices")).rejects.toMatchObject({ code: "SESSION_EXPIRED" });

    expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith("/admin/login?error=session_expired");
  });

  it("CSV usa fetch autenticado", async () => {
    mocks.getSession.mockResolvedValue(session("csv_token"));
    const createObjectURL = vi.fn(() => "blob:csv");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    const click = vi.fn();
    vi.spyOn(document, "createElement").mockReturnValue({ click } as unknown as HTMLAnchorElement);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("a,b\n1,2", { status: 200, headers: { "Content-Type": "text/csv" } })));
    const { downloadAdminCsv } = await import("@/lib/admin-api-client");

    await downloadAdminCsv("/api/admin/payments?format=csv", "pagos.csv");

    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer csv_token");
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:csv");
  });

  it("no expone service role", () => {
    const source = fs.readFileSync("lib/admin-api-client.ts", "utf8");
    expect(source).not.toMatch(/SERVICE_ROLE|SUPABASE_SERVICE_ROLE_KEY|service_role/i);
  });
});

describe("AdminShell navigation", () => {
  it("marca ruta activa", async () => {
    mocks.getSession.mockResolvedValue(session("access_123"));
    const { AdminNav } = await import("@/app/admin/AdminClient");

    render(<AdminNav />);

    expect(screen.getByRole("img", { name: "PILULA MedPlanner" })).toBeInTheDocument();
    const pagos = screen.getByRole("link", { name: "Pagos" });
    expect(pagos.className).toContain("text-pilula-gold");
  });
});
