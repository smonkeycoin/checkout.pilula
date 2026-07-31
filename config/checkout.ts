export const EVENT = {
  brand: "PILULA MedPlanner",
  program: "Hair Transplant Workshop by GeVa",
  editionLabel: "7ª edición",
  editionMetadata: "2026-10",
  eventMetadata: "htw_geva_7",
  dateLabel: "26 al 30 de octubre de 2026",
  dateShort: "26-30 OCT 2026",
  location: "Latitud Polanco, Ciudad de México",
  format: ["60 horas", "5 dias", "4 dias hands-on", "16 medicos", "8 pacientes seleccionados"],
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "info@pilula.com.mx",
  supportWhatsapp: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "525532019586",
  mainSiteUrl: process.env.NEXT_PUBLIC_MAIN_SITE_URL || "https://www.pilula.com.mx",
  landingUrl: process.env.NEXT_PUBLIC_LANDING_URL || "https://landing.pilula.com.mx"
} as const;

export const DISPLAY_CURRENCY = "USD";

export const PLANS = {
  doctor: {
    profileType: "doctor",
    title: "Medico participante",
    displayTitle: "Médico participante",
    subtotal: 600000,
    tax: 96000,
    total: 696000,
    cta: "Inscribirme como médico",
    microcopy: "Pago unico. Cupo sujeto a disponibilidad y confirmacion de inscripcion.",
    stripePriceEnv: "STRIPE_PRICE_DOCTOR"
  },
  patient: {
    profileType: "patient",
    title: "Paciente seleccionado",
    displayTitle: "Paciente seleccionado",
    subtotal: 80000,
    tax: 12800,
    total: 92800,
    cta: "Continuar con pago de paciente aprobado",
    publicCta: "Continuar con valoración médica",
    requiredCopy:
      "Disponible únicamente después de valoración médica, indicación clínica y confirmación del equipo organizador.",
    stripePriceEnv: "STRIPE_PRICE_PATIENT"
  }
} as const;

export type PlanKey = keyof typeof PLANS;
export type PaymentCurrency = "usd" | "mxn";
export type PaymentMethod = "card" | "bank_transfer";
export type AllowedPaymentMethods = "card" | "bank_transfer" | "card_and_bank_transfer";
export type Market = "mexico" | "international";

export function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: DISPLAY_CURRENCY,
    currencyDisplay: "code",
    minimumFractionDigits: 2
  })
    .format(cents / 100)
    .replace(/\s/u, " ");
}

export function formatMoney(cents: number, currency: PaymentCurrency) {
  return new Intl.NumberFormat(currency === "mxn" ? "es-MX" : "en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    currencyDisplay: "code",
    minimumFractionDigits: 2
  })
    .format(cents / 100)
    .replace(/\s/u, " ");
}

export function getPlan(plan: string) {
  if (plan === "doctor" || plan === "patient") {
    return PLANS[plan];
  }
  return null;
}

export function getExpectedAmounts(plan: PlanKey) {
  const selected = PLANS[plan];
  return {
    currency: "usd",
    amount_subtotal: selected.subtotal,
    amount_tax: selected.tax,
    amount_total: selected.total
  };
}
