import { Resend } from "resend";
import type { OrderRecord } from "@/lib/orders";
import { getEnv } from "@/lib/env";
import { buyerEmail, buildCalendarIcs, ownerEmail } from "@/emails/templates";
import type { PaymentInvite } from "@/lib/payment-invites";
import type Stripe from "stripe";

let resend: Resend | null = null;
const sentKeys = new Set<string>();

function getResend() {
  const env = getEnv();
  if (!env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(env.RESEND_API_KEY);
  return resend;
}

export async function sendPaymentEmails(order: OrderRecord) {
  const env = getEnv();
  const client = getResend();
  const siteUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const dedupeKey = `payment:${order.id}`;

  if (sentKeys.has(dedupeKey)) {
    return { sent: false, reason: "already_sent_in_process" };
  }

  if (!client || !order.email) {
    return { sent: false, reason: "resend_not_configured" };
  }

  const buyer = buyerEmail(order, siteUrl);
  const owner = ownerEmail(order, siteUrl);
  const ics = buildCalendarIcs();

  await client.emails.send({
    from: env.EMAIL_FROM,
    to: order.email,
    replyTo: env.EMAIL_REPLY_TO,
    subject: "Pago confirmado · Hair Transplant Workshop 2026",
    html: buyer.html,
    text: buyer.text,
    attachments: [
      {
        filename: "hair-transplant-workshop-2026.ics",
        content: Buffer.from(ics).toString("base64")
      }
    ]
  });

  await client.emails.send({
    from: env.EMAIL_FROM,
    to: env.YOANNA_NOTIFICATION_EMAIL,
    replyTo: env.EMAIL_REPLY_TO,
    subject: `[PILULA] Nuevo pago confirmado · ${order.profile_type === "patient" ? "Paciente" : "Médico"}`,
    html: owner.html,
    text: owner.text
  });

  sentKeys.add(dedupeKey);
  return { sent: true };
}

export async function sendPaymentInviteEmail(invite: PaymentInvite, url: string) {
  const env = getEnv();
  const client = getResend();
  if (!client) return { sent: false, reason: "resend_not_configured" };

  await client.emails.send({
    from: env.EMAIL_FROM,
    to: invite.email,
    replyTo: env.EMAIL_REPLY_TO,
    subject: "Tu enlace privado de pago · Hair Transplant Workshop 2026",
    html: `
      <div style="font-family:Arial,sans-serif;background:#080808;color:#F8F4EA;padding:32px">
        <div style="max-width:640px;margin:auto;border:1px solid #C4A64A;padding:28px">
          <p style="color:#C4A64A;letter-spacing:0.08em">PÍLULA MEDPLANNER</p>
          <h1>Enlace privado de pago</h1>
          <p>${invite.full_name || invite.email}, tu invitación fue aprobada.</p>
          <p><a href="${url}" style="display:inline-block;background:#660033;color:#FFFFFF;padding:12px 18px;text-decoration:none">Abrir enlace privado</a></p>
          <p>El pago se procesa en Stripe. No compartas este enlace.</p>
        </div>
      </div>`,
    text: `Tu invitación fue aprobada.\nAbre tu enlace privado de pago: ${url}\nEl pago se procesa en Stripe.`
  });

  return { sent: true };
}

export async function notifyInvoiceRequest(input: { orderReference: string; invoiceEmail: string }) {
  const env = getEnv();
  const client = getResend();
  if (!client) return { sent: false, reason: "resend_not_configured" };

  await client.emails.send({
    from: env.EMAIL_FROM,
    to: env.ACCOUNTING_NOTIFICATION_EMAIL || env.YOANNA_NOTIFICATION_EMAIL,
    replyTo: env.EMAIL_REPLY_TO,
    subject: "[PILULA] Nueva solicitud de factura",
    html: `<p>Nueva solicitud de factura para la orden ${input.orderReference}.</p><p>Correo factura: ${input.invoiceEmail}</p>`,
    text: `Nueva solicitud de factura para la orden ${input.orderReference}.\nCorreo factura: ${input.invoiceEmail}`
  });

  return { sent: true };
}

export async function notifyManualReview(input: { orderReference: string; reason: string }) {
  const env = getEnv();
  const client = getResend();
  if (!client) return { sent: false, reason: "resend_not_configured" };
  await client.emails.send({
    from: env.EMAIL_FROM,
    to: env.YOANNA_NOTIFICATION_EMAIL,
    replyTo: env.EMAIL_REPLY_TO,
    subject: "[PILULA] Pago requiere revisión manual",
    html: `<p>Orden ${input.orderReference} requiere revisión manual.</p><p>Motivo: ${input.reason}</p>`,
    text: `Orden ${input.orderReference} requiere revisión manual.\nMotivo: ${input.reason}`
  });
  return { sent: true };
}

export async function sendBankTransferInstructionsEmail(order: OrderRecord, session: Stripe.Checkout.Session) {
  const env = getEnv();
  const client = getResend();
  const paymentIntent = typeof session.payment_intent === "string" ? null : session.payment_intent;
  const instructions = paymentIntent?.next_action?.display_bank_transfer_instructions;
  if (!client || !order.email || !instructions) return { sent: false, reason: "instructions_not_available" };
  await client.emails.send({
    from: env.EMAIL_FROM,
    to: order.email,
    replyTo: env.EMAIL_REPLY_TO,
    subject: "Instrucciones SPEI · Hair Transplant Workshop 2026",
    html: `
      <div style="font-family:Arial,sans-serif;background:#080808;color:#F8F4EA;padding:32px">
        <div style="max-width:640px;margin:auto;border:1px solid #C4A64A;padding:28px">
          <h1>Instrucciones SPEI proporcionadas por Stripe</h1>
          <p>Referencia: <strong>${instructions.reference || "Disponible en Stripe"}</strong></p>
          <p>Importe pendiente: ${instructions.amount_remaining ?? order.amount_total} ${String(instructions.currency || order.currency).toUpperCase()}</p>
          ${instructions.hosted_instructions_url ? `<p><a href="${instructions.hosted_instructions_url}" style="color:#C4A64A">Abrir instrucciones alojadas por Stripe</a></p>` : ""}
          <p>Tu lugar quedará confirmado cuando Stripe notifique la recepción completa de los fondos.</p>
          <p>Una transferencia sin referencia correcta puede tardar en conciliarse.</p>
        </div>
      </div>`,
    text: [
      "Instrucciones SPEI proporcionadas por Stripe",
      `Referencia: ${instructions.reference || "Disponible en Stripe"}`,
      `Importe pendiente: ${instructions.amount_remaining ?? order.amount_total} ${String(instructions.currency || order.currency).toUpperCase()}`,
      instructions.hosted_instructions_url ? `Instrucciones: ${instructions.hosted_instructions_url}` : "",
      "Tu lugar quedará confirmado cuando Stripe notifique la recepción completa de los fondos.",
      "Una transferencia sin referencia correcta puede tardar en conciliarse."
    ].filter(Boolean).join("\n")
  });
  return { sent: true };
}
