import { describe, expect, it } from "vitest";
import { applyPercentDiscount, calculateMxnAmounts, multiplyCentsByRate, normalizeDiscountPercent } from "@/lib/money";

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

  it("aplica descuento porcentual sobre subtotal e IVA congelados", () => {
    expect(applyPercentDiscount(calculateMxnAmounts("patient", "17.50"), 25)).toEqual({
      currency: "mxn",
      amount_subtotal: 1050000,
      amount_tax: 168000,
      amount_total: 1218000
    });
  });

  it("aplica 10% de descuento sobre una invitacion doctor MXN", () => {
    expect(applyPercentDiscount(calculateMxnAmounts("doctor", "17.50"), 10)).toEqual({
      currency: "mxn",
      amount_subtotal: 9450000,
      amount_tax: 1512000,
      amount_total: 10962000
    });
  });

  it("rechaza descuentos fuera de rango para mantener Checkout con importe positivo", () => {
    expect(() => normalizeDiscountPercent(-1)).toThrow("El descuento debe ser un entero entre 0 y 99.");
    expect(() => normalizeDiscountPercent(100)).toThrow("El descuento debe ser un entero entre 0 y 99.");
    expect(() => normalizeDiscountPercent(150)).toThrow("El descuento debe ser un entero entre 0 y 99.");
  });
});
