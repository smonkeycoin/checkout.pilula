import { z } from "zod";
import { buildPaymentInviteUrl, createPaymentInvite } from "../lib/payment-invites";

const args = process.argv.slice(2);
function arg(name: string) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

const schema = z.object({
  profileType: z.enum(["doctor", "patient"]),
  market: z.enum(["mexico", "international"]).default("mexico"),
  paymentCurrency: z.enum(["usd", "mxn"]),
  allowedPaymentMethods: z.enum(["card", "bank_transfer", "card_and_bank_transfer"]),
  exchangeRate: z.string().optional(),
  email: z.string().email(),
  fullName: z.string().optional(),
  whatsapp: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  approved: z.boolean().default(true)
});

const parsed = schema.parse({
  profileType: arg("profile") || arg("profile-type"),
  market: arg("market") || (arg("currency") === "usd" ? "international" : "mexico"),
  paymentCurrency: arg("currency") || (arg("market") === "international" ? "usd" : "mxn"),
  allowedPaymentMethods: arg("methods") || (arg("currency") === "usd" ? "card" : "card_and_bank_transfer"),
  exchangeRate: arg("rate"),
  email: arg("email"),
  fullName: arg("name"),
  whatsapp: arg("whatsapp"),
  expiresAt: arg("expires-at"),
  approved: arg("pending") ? false : true
});

const { invite, token } = await createPaymentInvite({
  profileType: parsed.profileType,
  market: parsed.market,
  paymentCurrency: parsed.paymentCurrency,
  allowedPaymentMethods: parsed.allowedPaymentMethods,
  exchangeRate: parsed.exchangeRate,
  exchangeRateSource: parsed.exchangeRate ? "CLI" : undefined,
  email: parsed.email,
  fullName: parsed.fullName,
  whatsapp: parsed.whatsapp,
  expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : undefined,
  approved: parsed.approved,
  createdBy: "script"
});

console.log("URL privada de pago. Copiar ahora; el token no se volvera a mostrar.");
console.log(buildPaymentInviteUrl(token));
console.log(`Invitacion: ${invite.id}`);
console.log(`Modalidad: ${invite.profile_type}`);
console.log(`Expira: ${invite.expires_at}`);
if (!process.env.RESEND_API_KEY) {
  console.log("RESEND_API_KEY no esta configurado; no se envio correo automaticamente.");
}
