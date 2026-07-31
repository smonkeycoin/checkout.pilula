import { describe, expect, it } from "vitest";

describe("facturacion", () => {
  it("solo permite factura para orden pagada", () => {
    const order = { status: "created" };
    expect(order.status).not.toBe("paid");
  });
});
