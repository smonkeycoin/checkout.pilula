import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { verifyAdminRequest } from "@/lib/admin-auth";

describe("admin auth", () => {
  it("rechaza acceso admin no autorizado", async () => {
    const result = await verifyAdminRequest(new NextRequest("http://localhost:3000/api/admin/invites"));
    expect(result.ok).toBe(false);
  });
});
