import { PLANS, type PaymentCurrency, type PlanKey } from "@/config/checkout";

const RATE_SCALE = 1_000_000n;

export function parseRateToMicros(rate: string) {
  const normalized = rate.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(normalized)) {
    throw new Error("Tipo de cambio invalido");
  }
  const [whole, fraction = ""] = normalized.split(".");
  return BigInt(whole) * RATE_SCALE + BigInt(fraction.padEnd(6, "0"));
}

export function multiplyCentsByRate(cents: number, rate: string) {
  const rateMicros = parseRateToMicros(rate);
  const value = BigInt(cents) * rateMicros;
  return Number((value + RATE_SCALE / 2n) / RATE_SCALE);
}

export function calculateMxnAmounts(plan: PlanKey, rate: string) {
  const subtotal = multiplyCentsByRate(PLANS[plan].subtotal, rate);
  const tax = Number((BigInt(subtotal) * 16n + 50n) / 100n);
  return {
    currency: "mxn" as const,
    amount_subtotal: subtotal,
    amount_tax: tax,
    amount_total: subtotal + tax
  };
}

export function baseUsdAmounts(plan: PlanKey) {
  const selected = PLANS[plan];
  return {
    currency: "usd" as const,
    amount_subtotal: selected.subtotal,
    amount_tax: selected.tax,
    amount_total: selected.total
  };
}

export function calculateInviteAmounts(plan: PlanKey, currency: PaymentCurrency, rate?: string | null) {
  if (currency === "usd") return baseUsdAmounts(plan);
  if (!rate) throw new Error("La moneda MXN requiere tipo de cambio");
  return calculateMxnAmounts(plan, rate);
}
