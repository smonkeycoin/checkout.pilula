import { getEnv } from "@/lib/env";
import { getPlan, type PlanKey } from "@/config/checkout";

export function getStripePriceId(plan: PlanKey) {
  const env = getEnv();
  return plan === "doctor" ? env.STRIPE_PRICE_DOCTOR : env.STRIPE_PRICE_PATIENT;
}

export function resolveCheckoutPlan(input: unknown) {
  if (input === "doctor" || input === "patient") {
    return {
      plan: input,
      priceId: getStripePriceId(input),
      config: getPlan(input)
    };
  }

  throw new Error("Plan invalido");
}
