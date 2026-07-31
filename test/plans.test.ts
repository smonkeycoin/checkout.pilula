import { describe, expect, it, vi } from "vitest";
import { getExpectedAmounts, formatUsd } from "@/config/checkout";

describe("planes y montos", () => {
  it("calcula y presenta subtotal, IVA y total de medico", () => {
    expect(getExpectedAmounts("doctor")).toEqual({
      currency: "usd",
      amount_subtotal: 600000,
      amount_tax: 96000,
      amount_total: 696000
    });
    expect(formatUsd(696000)).toBe("USD 6,960.00");
  });

  it("calcula y presenta subtotal, IVA y total de paciente", () => {
    expect(getExpectedAmounts("patient")).toEqual({
      currency: "usd",
      amount_subtotal: 80000,
      amount_tax: 12800,
      amount_total: 92800
    });
    expect(formatUsd(92800)).toBe("USD 928.00");
  });

  it("total Doctor USD 6,960", () => {
    expect(formatUsd(getExpectedAmounts("doctor").amount_total)).toBe("USD 6,960.00");
  });

  it("total Paciente USD 928", () => {
    expect(formatUsd(getExpectedAmounts("patient").amount_total)).toBe("USD 928.00");
  });
});

describe("mapeo interno Stripe", () => {
  it("mapea doctor al Price ID de doctor", async () => {
    vi.stubEnv("STRIPE_PRICE_DOCTOR", "price_doctor_test");
    vi.stubEnv("STRIPE_PRICE_PATIENT", "price_patient_test");
    const { getStripePriceId } = await import("@/lib/stripe/plans");
    expect(getStripePriceId("doctor")).toBe("price_doctor_test");
  });

  it("mapea patient al Price ID de paciente", async () => {
    vi.stubEnv("STRIPE_PRICE_DOCTOR", "price_doctor_test");
    vi.stubEnv("STRIPE_PRICE_PATIENT", "price_patient_test");
    const { getStripePriceId } = await import("@/lib/stripe/plans");
    expect(getStripePriceId("patient")).toBe("price_patient_test");
  });
});
