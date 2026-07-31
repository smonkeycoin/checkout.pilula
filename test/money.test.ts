import { describe, expect, it } from "vitest";
import { calculateMxnAmounts, multiplyCentsByRate } from "@/lib/money";

describe("calculo MXN", () => {
  it("convierte centavos USD a centavos MXN con redondeo decimal seguro", () => {
    expect(multiplyCentsByRate(600000, "18.50")).toBe(11100000);
  });

  it("calcula doctor MXN con IVA desde subtotal MXN", () => {
    expect(calculateMxnAmounts("doctor", "18.50")).toEqual({
      currency: "mxn",
      amount_subtotal: 11100000,
      amount_tax: 1776000,
      amount_total: 12876000
    });
  });
});
