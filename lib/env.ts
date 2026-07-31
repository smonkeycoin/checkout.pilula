import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_MAIN_SITE_URL: z.string().url().default("https://www.pilula.com.mx"),
  NEXT_PUBLIC_LANDING_URL: z.string().url().default("https://landing.pilula.com.mx"),
  NEXT_PUBLIC_SUPPORT_EMAIL: z.string().email().default("info@pilula.com.mx"),
  NEXT_PUBLIC_SUPPORT_WHATSAPP: z.string().default("525532019586"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional().default(""),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional().default(""),
  STRIPE_SECRET_KEY: z.string().default("sk_test_placeholder"),
  STRIPE_WEBHOOK_SECRET: z.string().default("whsec_placeholder"),
  STRIPE_PRICE_DOCTOR: z.string().default("price_placeholder"),
  STRIPE_PRICE_PATIENT: z.string().default("price_placeholder"),
  STRIPE_TAX_RATE_IVA_16: z.string().default("txr_placeholder"),
  SUPABASE_URL: z.string().optional().default(""),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(""),
  RESEND_API_KEY: z.string().optional().default(""),
  EMAIL_FROM: z.string().default("PILULA MedPlanner <pagos@pilula.com.mx>"),
  EMAIL_REPLY_TO: z.string().email().default("info@pilula.com.mx"),
  YOANNA_NOTIFICATION_EMAIL: z.string().email().default("pilulamedplanner@gmail.com"),
  ACCOUNTING_NOTIFICATION_EMAIL: z.string().email().optional().or(z.literal("")).default(""),
  PATIENT_INVITE_TTL_HOURS: z.coerce.number().int().positive().default(168),
  INVOICE_LINK_SECRET: z.string().optional().default(""),
  LEGAL_TERMS_VERSION: z.string().default("2026-01"),
  LEGAL_CANCELLATION_POLICY_VERSION: z.string().default("2026-01"),
  LEGAL_APPROVED: z.string().default("false")
});

export type AppEnv = z.infer<typeof envSchema>;

export function getEnv(): AppEnv {
  return envSchema.parse(process.env);
}

export function isPlaceholder(value: string) {
  return value.includes("placeholder") || value.trim().length === 0;
}

export function isLiveStripeKey(value: string) {
  return value.startsWith("sk_live_");
}
