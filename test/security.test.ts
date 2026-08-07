import { describe, expect, it } from "vitest";
import { getStripeEnvironment } from "@/lib/env";
import { hashToken, verifySignedInvoiceToken } from "@/lib/security/tokens";

describe("tokens de paciente", () => {
  it("hashea tokens y no conserva el valor plano", () => {
    const token = "token-super-secreto";
    const hash = hashToken(token);
    expect(hash).not.toBe(token);
    expect(hash).toHaveLength(64);
  });
});

describe("factura", () => {
  it("rechaza enlaces de factura invalidos o vencidos", () => {
    expect(verifySignedInvoiceToken("00000000-0000-0000-0000-000000000000", "invalido")).toBe(false);
  });
});

describe("stripe environment", () => {
  it("reconoce llaves restricted como Test y Live", () => {
    expect(getStripeEnvironment("rk_test_123")).toBe("test");
    expect(getStripeEnvironment("rk_live_123")).toBe("live");
  });
});
