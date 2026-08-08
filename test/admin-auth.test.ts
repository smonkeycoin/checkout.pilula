import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAdminAllowedEmails, isAdminAllowedEmail, verifyAdminRequest } from "@/lib/admin-auth";

describe("admin auth", () => {
  const originalAllowedEmail = process.env.ADMIN_ALLOWED_EMAIL;

  afterEach(() => {
    if (originalAllowedEmail === undefined) {
      delete process.env.ADMIN_ALLOWED_EMAIL;
    } else {
      process.env.ADMIN_ALLOWED_EMAIL = originalAllowedEmail;
    }
  });

  it("rechaza acceso admin no autorizado", async () => {
    const result = await verifyAdminRequest(new NextRequest("http://localhost:3000/api/admin/invites"));
    expect(result.ok).toBe(false);
  });

  it("acepta una lista de correos admin separada por comas", () => {
    process.env.ADMIN_ALLOWED_EMAIL = "pilulamedplanner@gmail.com, trinopc1@gmail.com";

    expect(getAdminAllowedEmails()).toEqual(["pilulamedplanner@gmail.com", "trinopc1@gmail.com"]);
    expect(isAdminAllowedEmail("TRINOPC1@gmail.com")).toBe(true);
    expect(isAdminAllowedEmail("otra@example.com")).toBe(false);
  });

  it("rechaza server-side a un usuario autenticado fuera de allowlist", async () => {
    vi.resetModules();
    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => ({
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { email: "externo@example.com" } },
            error: null
          }))
        }
      }))
    }));
    process.env.ADMIN_ALLOWED_EMAIL = "pilulamedplanner@gmail.com,trinopc1@gmail.com";
    process.env.SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    const { verifyAdminRequest: verifyWithMock } = await import("@/lib/admin-auth");

    const result = await verifyWithMock(
      new NextRequest("http://localhost:3000/api/admin/dashboard", {
        headers: { authorization: "Bearer valid_google_session_token" }
      })
    );

    expect(result).toEqual({ ok: false, error: "No autorizado", reason: "email_not_allowed" });
    vi.doUnmock("@supabase/supabase-js");
  });
});
