import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_MAIN_SITE_URL: z.string().url().default("https://www.pilula.com.mx"),
  NEXT_PUBLIC_LANDING_URL: z.string().url().default("https://landing.pilula.com.mx"),
  NEXT_PUBLIC_SUPPORT_EMAIL: z.string().email().default("info@pilula.com.mx"),
  NEXT_PUBLIC_SUPPORT_WHATSAPP: z.string().default("525532019586"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional().default(""),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional().default(""),
  ADMIN_ALLOWED_EMAIL: z.string().default("pilulamedplanner@gmail.com"),
  STRIPE_SECRET_KEY: z.string().optional().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(""),
  STRIPE_PRICE_DOCTOR: z.string().optional().default(""),
  STRIPE_PRICE_PATIENT: z.string().optional().default(""),
  STRIPE_TAX_RATE_IVA_16: z.string().optional().default(""),
  SUPABASE_URL: z.string().optional().default(""),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(""),
  RESEND_API_KEY: z.string().optional().default(""),
  EMAIL_FROM: z.string().default("PILULA MedPlanner <pagos@pilula.com.mx>"),
  EMAIL_REPLY_TO: z.string().email().default("info@pilula.com.mx"),
  YOANNA_NOTIFICATION_EMAIL: z.string().email().default("pilulamedplanner@gmail.com"),
  ACCOUNTING_NOTIFICATION_EMAIL: z.string().email().optional().or(z.literal("")).default(""),
  PATIENT_INVITE_TTL_HOURS: z.coerce.number().int().positive().default(168),
  INVOICE_LINK_SECRET: z.string().optional().default(""),
  PAYMENT_INVITE_OTP_SECRET: z.string().optional().default(""),
  LEGAL_TERMS_VERSION: z.string().default("2026-01"),
  LEGAL_CANCELLATION_POLICY_VERSION: z.string().default("2026-01"),
  LEGAL_APPROVED: z.string().default("false")
});

export type AppEnv = z.infer<typeof envSchema>;
export type StripeEnvironment = "test" | "live";

const PUBLIC_SECRET_PREFIXES = [
  "sk_live_",
  "sk_test_",
  "rk_live_",
  "rk_test_",
  "whsec_",
  "supabase_service_role"
];
const PUBLIC_SECRET_NAME_PARTS = ["SECRET", "SERVICE_ROLE", "WEBHOOK", "OIDC_TOKEN", "RESEND_API_KEY"];

export class EnvConfigurationError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "EnvConfigurationError";
  }
}

export function getEnv(): AppEnv {
  return envSchema.parse(process.env);
}

export function isPlaceholder(value: string) {
  return value.includes("placeholder") || value.trim().length === 0;
}

export function isLiveStripeKey(value: string) {
  return value.startsWith("sk_live_") || value.startsWith("rk_live_");
}

export function isTestStripeKey(value: string) {
  return value.startsWith("sk_test_") || value.startsWith("rk_test_");
}

export function getStripeEnvironment(secretKey = getEnv().STRIPE_SECRET_KEY): StripeEnvironment | null {
  if (isLiveStripeKey(secretKey)) return "live";
  if (isTestStripeKey(secretKey)) return "test";
  return null;
}

export function isProductionDeployment() {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === "production";
  return process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://");
}

export function findPublicSecretLeaks(source: NodeJS.ProcessEnv = process.env) {
  return Object.entries(source)
    .filter(([key, value]) => {
      if (!key.startsWith("NEXT_PUBLIC_") || !value) return false;
      const normalized = value.trim().toLowerCase();
      return (
        PUBLIC_SECRET_NAME_PARTS.some((part) => key.includes(part)) ||
        PUBLIC_SECRET_PREFIXES.some((prefix) => normalized.startsWith(prefix))
      );
    })
    .map(([key]) => key);
}

function assertStripeId(name: string, value: string, prefix: string) {
  if (isPlaceholder(value) || !value.startsWith(prefix)) {
    throw new EnvConfigurationError("STRIPE_ENV_INCOMPLETE", `${name} no esta configurado con un ID ${prefix} valido.`);
  }
}

export function assertPaymentRuntimeReady(options: { requireWebhookSecret?: boolean } = {}) {
  const env = getEnv();
  const publicLeaks = findPublicSecretLeaks();
  if (publicLeaks.length) {
    throw new EnvConfigurationError("PUBLIC_SECRET_LEAK", "Hay secretos configurados en variables NEXT_PUBLIC_.");
  }

  const stripeEnvironment = getStripeEnvironment(env.STRIPE_SECRET_KEY);
  if (!stripeEnvironment) {
    throw new EnvConfigurationError("STRIPE_SECRET_KEY_INVALID", "STRIPE_SECRET_KEY debe ser sk_test_, rk_test_, sk_live_ o rk_live_.");
  }

  assertStripeId("STRIPE_PRICE_DOCTOR", env.STRIPE_PRICE_DOCTOR, "price_");
  assertStripeId("STRIPE_PRICE_PATIENT", env.STRIPE_PRICE_PATIENT, "price_");
  assertStripeId("STRIPE_TAX_RATE_IVA_16", env.STRIPE_TAX_RATE_IVA_16, "txr_");

  if (options.requireWebhookSecret) {
    assertStripeId("STRIPE_WEBHOOK_SECRET", env.STRIPE_WEBHOOK_SECRET, "whsec_");
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new EnvConfigurationError("SUPABASE_SERVER_ENV_MISSING", "Supabase server env no esta configurado.");
  }

  if (isProductionDeployment()) {
    if (stripeEnvironment !== "live") {
      throw new EnvConfigurationError("PRODUCTION_REQUIRES_STRIPE_LIVE", "Produccion debe usar Stripe Live.");
    }
    if (!env.NEXT_PUBLIC_SITE_URL.startsWith("https://")) {
      throw new EnvConfigurationError("PRODUCTION_SITE_URL_INVALID", "NEXT_PUBLIC_SITE_URL debe ser HTTPS en produccion.");
    }
    if (env.LEGAL_APPROVED !== "true") {
      throw new EnvConfigurationError("LEGAL_APPROVAL_REQUIRED", "Lanzamiento Live bloqueado hasta aprobacion legal.");
    }
  }

  return {
    stripeEnvironment,
    livemode: stripeEnvironment === "live"
  };
}

export function assertStripeLivemodeMatchesRuntime(livemode: boolean) {
  const runtime = assertPaymentRuntimeReady({ requireWebhookSecret: true });
  if (runtime.livemode !== livemode) {
    throw new EnvConfigurationError("STRIPE_LIVEMODE_MISMATCH", "El evento de Stripe no coincide con el modo configurado.");
  }
  return runtime;
}
