import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
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
});
