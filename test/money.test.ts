import { describe, expect, it } from "vitest";
import { calculateMxnAmounts, multiplyCentsByRate } from "@/lib/money";

describe("calculo MXN", () => {
  it("convierte centavos USD a centavos MXN con redondeo decimal seguro", () => {
    expect(multiplyCentsByRate(600000, "17.50")).toBe(10500000);
  });

  it("calcula doctor MXN con IVA desde subtotal MXN a 17.50", () => {
    expect(calculateMxnAmounts("doctor", "17.50")).toEqual({
      currency: "mxn",
      amount_subtotal: 10500000,
      amount_tax: 1680000,
      amount_total: 12180000
    });
  });

  it("calcula paciente MXN con IVA incluido a 17.50", () => {
    expect(calculateMxnAmounts("patient", "17.50")).toEqual({
      currency: "mxn",
      amount_subtotal: 1400000,
      amount_tax: 224000,
      amount_total: 1624000
    });
  });
});
