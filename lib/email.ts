import { Resend } from "resend";
import type { OrderRecord } from "@/lib/orders";
import { getEnv } from "@/lib/env";
import { buyerEmail, buildCalendarIcs, ownerEmail } from "@/emails/templates";
import type { PaymentInvite } from "@/lib/payment-invites";
import type Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

let resend: Resend | null = null;
const sentKeys = new Set<string>();
type ResendPayload = Parameters<Resend["emails"]["send"]>[0];
type EmailSendResult =
  | { sent: true; emailId: string }
  | { sent: false; reason: "already_sent_in_process" | "resend_not_configured" | "resend_error" | "missing_email_id" | "instructions_not_available"; errorCode?: string; emailId?: string };

function brandedEmailFrom(configuredFrom: string) {
  const fallbackAddress = "pagos@pilula.com.mx";
  const bracketMatch = configuredFrom.match(/<([^>]+)>/u);
  const bareEmailMatch = configuredFrom.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu);
  const address = bracketMatch?.[1]?.trim() || bareEmailMatch?.[0]?.trim() || fallbackAddress;
  return `PILULA MedPlanner <${address}>`;
}

function getResend() {
  const env = getEnv();
  if (!env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(env.RESEND_API_KEY);
  return resend;
}

async function getPaymentConfirmationState(orderId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data } = await supabase
    .from("pilula_orders")
    .select("buyer_confirmation_sent_at,buyer_confirmation_email_id,owner_confirmation_sent_at,owner_confirmation_email_id")
    .eq("id", orderId)
    .maybeSingle();
  return (data as Pick<
    OrderRecord,
    | "buyer_confirmation_sent_at"
    | "buyer_confirmation_email_id"
    | "owner_confirmation_sent_at"
    | "owner_confirmation_email_id"
  > | null) || null;
}

async function markPaymentConfirmationSent(orderId: string, fields: Record<string, string>) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  await supabase.from("pilula_orders").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", orderId);
}

export async function sendResendEmail(payload: ResendPayload): Promise<EmailSendResult> {
  const client = getResend();
  if (!client) return { sent: false, reason: "resend_not_configured" };

  const result = await client.emails.send(payload);
  if (result.error) {
    const statusCode = "statusCode" in result.error ? result.error.statusCode : undefined;
    console.error("[resend:send_failed]", {
      name: result.error.name,
      message: result.error.message,
      statusCode
    });

    return {
      sent: false,
      reason: "resend_error",
      errorCode: result.error.name
    };
  }

  if (!result.data?.id) {
    console.error("[resend:missing_email_id]");
    return {
      sent: false,
      reason: "missing_email_id"
    };
  }

  console.info("[resend:sent]", {
    emailId: result.data.id
  });

  return {
    sent: true,
    emailId: result.data.id
  };
}

export async function sendPaymentEmails(order: OrderRecord): Promise<EmailSendResult> {
  const env = getEnv();
  const from = brandedEmailFrom(env.EMAIL_FROM);
  const siteUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const dedupeKey = `payment:${order.id}`;

  if (sentKeys.has(dedupeKey)) {
    return { sent: false, reason: "already_sent_in_process" };
  }

  if (!order.email) {
    return { sent: false, reason: "resend_not_configured" };
  }

  const confirmationState = await getPaymentConfirmationState(order.id);
  const buyerAlreadySent = Boolean(confirmationState?.buyer_confirmation_sent_at || order.buyer_confirmation_sent_at);
  const ownerAlreadySent = Boolean(confirmationState?.owner_confirmation_sent_at || order.owner_confirmation_sent_at);
  if (buyerAlreadySent && ownerAlreadySent) {
    sentKeys.add(dedupeKey);
    return { sent: false, reason: "already_sent_in_process" };
  }

  const buyer = buyerEmail(order, siteUrl);
  const owner = ownerEmail(order, siteUrl);
  const ics = buildCalendarIcs();
  let lastEmailId = confirmationState?.owner_confirmation_email_id || confirmationState?.buyer_confirmation_email_id || "";

  if (!buyerAlreadySent) {
    const buyerResult = await sendResendEmail({
      from,
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
    if (!buyerResult.sent) return buyerResult;
    lastEmailId = buyerResult.emailId;
    await markPaymentConfirmationSent(order.id, {
      buyer_confirmation_sent_at: new Date().toISOString(),
      buyer_confirmation_email_id: buyerResult.emailId
    });
  }

  if (!ownerAlreadySent) {
    const ownerResult = await sendResendEmail({
      from,
      to: env.YOANNA_NOTIFICATION_EMAIL,
      replyTo: env.EMAIL_REPLY_TO,
      subject: `[PILULA] Nuevo pago confirmado · ${order.profile_type === "patient" ? "Paciente" : "Médico"}`,
      html: owner.html,
      text: owner.text
    });
    if (!ownerResult.sent) return ownerResult;
    lastEmailId = ownerResult.emailId;
    await markPaymentConfirmationSent(order.id, {
      owner_confirmation_sent_at: new Date().toISOString(),
      owner_confirmation_email_id: ownerResult.emailId
    });
  }

  sentKeys.add(dedupeKey);
  return { sent: true, emailId: lastEmailId || "already-sent" };
}

export async function sendDepositConfirmationEmail(order: OrderRecord, balanceUrl: string): Promise<EmailSendResult> {
  const env = getEnv();
  const from = brandedEmailFrom(env.EMAIL_FROM);
  if (!order.email) return { sent: false, reason: "resend_not_configured" };
  const amountPaid = new Intl.NumberFormat(order.currency === "mxn" ? "es-MX" : "en-US", {
    style: "currency",
    currency: order.currency.toUpperCase(),
    currencyDisplay: "code"
  }).format((order.amount_received || order.deposit_amount || 0) / 100);
  const amountDue = new Intl.NumberFormat(order.currency === "mxn" ? "es-MX" : "en-US", {
    style: "currency",
    currency: order.currency.toUpperCase(),
    currencyDisplay: "code"
  }).format((order.amount_remaining || order.balance_amount || 0) / 100);

  return sendResendEmail({
    from,
    to: order.email,
    replyTo: env.EMAIL_REPLY_TO,
    subject: "Anticipo confirmado · Hair Transplant Workshop 2026",
    html: `
      <div style="font-family:Arial,sans-serif;background:#080808;color:#F8F4EA;padding:32px">
        <div style="max-width:640px;margin:auto;border:1px solid #C4A64A;padding:28px">
          <p style="color:#C4A64A;letter-spacing:0.08em">PILULA MEDPLANNER</p>
          <h1>Anticipo confirmado</h1>
          <p>Recibimos tu anticipo de <strong>${amountPaid}</strong>.</p>
          <p>Saldo pendiente: <strong>${amountDue}</strong>.</p>
          <p><a href="${balanceUrl}" style="display:inline-block;background:#660033;color:#FFFFFF;padding:12px 18px;text-decoration:none">Pagar saldo</a></p>
          <p>Tu orden: ${order.reference}</p>
        </div>
      </div>`,
    text: [
      "Anticipo confirmado",
      `Recibimos tu anticipo de ${amountPaid}.`,
      `Saldo pendiente: ${amountDue}.`,
      `Pagar saldo: ${balanceUrl}`,
      `Orden: ${order.reference}`
    ].join("\n")
  });
}

export async function sendPaymentInviteEmail(invite: PaymentInvite, url: string): Promise<EmailSendResult> {
  const env = getEnv();
  const from = brandedEmailFrom(env.EMAIL_FROM);
  const greeting = buildInviteGreeting(invite.full_name);
  const isDeposit = invite.payment_option === "deposit";
  const paymentCopy = isDeposit
    ? "Puedes apartar tu lugar pagando el 50% ahora."
    : "Puedes completar tu inscripción desde tu enlace privado.";
  const installmentHtml = isDeposit
    ? `
          <div style="margin:20px 0;padding:16px;border:1px solid rgba(196,166,74,0.45)">
            <p style="margin:0 0 8px"><strong>Pago inicial:</strong> 50%</p>
            <p style="margin:0 0 8px"><strong>Saldo:</strong> 50%</p>
            <p style="margin:0"><strong>Plazo para liquidar:</strong> 45 días después de tu anticipo</p>
          </div>`
    : "";
  const installmentText = isDeposit
    ? "\nPago inicial: 50%\nSaldo: 50%\nPlazo para liquidar: 45 días después de tu anticipo"
    : "";

  return sendResendEmail({
    from,
    to: invite.email,
    replyTo: env.EMAIL_REPLY_TO,
    subject: "Tu enlace privado de pago · Hair Transplant Workshop 2026",
    html: `
      <div style="font-family:Arial,sans-serif;background:#080808;color:#F8F4EA;padding:32px">
        <div style="max-width:640px;margin:auto;border:1px solid #C4A64A;padding:28px">
          <p style="color:#C4A64A;letter-spacing:0.08em">PILULA MEDPLANNER</p>
          <h1>Enlace privado de pago</h1>
          <p>${greeting}</p>
          <p>Tu invitación para Hair Transplant Workshop 2026 fue aprobada.</p>
          <p>${paymentCopy}</p>
          ${installmentHtml}
          <p><a href="${url}" style="display:inline-block;background:#660033;color:#FFFFFF;padding:12px 18px;text-decoration:none">Abrir enlace privado</a></p>
          <p>Este enlace es personal y está asociado a tu invitación.</p>
          <p>El pago se procesa de forma segura con Stripe. No compartas este enlace.</p>
        </div>
      </div>`,
    text: [
      greeting,
      "Tu invitación para Hair Transplant Workshop 2026 fue aprobada.",
      paymentCopy,
      installmentText.trim(),
      `Abrir enlace privado: ${url}`,
      "Este enlace es personal y está asociado a tu invitación.",
      "El pago se procesa de forma segura con Stripe. No compartas este enlace."
    ].filter(Boolean).join("\n")
  });
}

function buildInviteGreeting(fullName: string | null | undefined) {
  const firstName = safeInviteFirstName(fullName);
  return firstName ? `Hola, ${firstName}` : "Hola";
}

function safeInviteFirstName(fullName: string | null | undefined) {
  const normalized = (fullName || "").trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  const lower = normalized.toLowerCase();
  const looksInternal =
    lower.includes("prueba") ||
    lower.includes("test") ||
    lower.includes("stripe") ||
    lower.includes("codex") ||
    lower.includes("internal") ||
    lower.includes("desarrollo") ||
    lower.includes("cleanup") ||
    /^[a-f0-9-]{8,}$/i.test(normalized) ||
    /^[-_a-z0-9]{10,}$/i.test(normalized) && /\d/.test(normalized);
  if (looksInternal) return "";
  const first = normalized.split(" ")[0]?.replace(/[^\p{L}'-]/gu, "") || "";
  if (first.length < 2 || first.length > 40) return "";
  return first.charAt(0).toLocaleUpperCase("es-MX") + first.slice(1).toLocaleLowerCase("es-MX");
}

export async function sendPaymentInviteOtpEmail(input: { email: string; code: string; expiresInMinutes: number }): Promise<EmailSendResult> {
  const env = getEnv();
  const from = brandedEmailFrom(env.EMAIL_FROM);

  return sendResendEmail({
    from,
    to: input.email,
    replyTo: env.EMAIL_REPLY_TO,
    subject: "Código de verificación · PILULA MedPlanner",
    html: `
      <div style="font-family:Arial,sans-serif;background:#080808;color:#F8F4EA;padding:32px">
        <div style="max-width:560px;margin:auto;border:1px solid #C4A64A;padding:28px">
          <p style="color:#C4A64A;letter-spacing:0.08em">PILULA MEDPLANNER</p>
          <h1>Verifica tu correo</h1>
          <p>Usa este código para continuar con tu pago privado:</p>
          <p style="font-size:32px;letter-spacing:0.2em;font-weight:bold">${input.code}</p>
          <p>El código vence en ${input.expiresInMinutes} minutos.</p>
        </div>
      </div>`,
    text: `Tu código de verificación PILULA es ${input.code}. Vence en ${input.expiresInMinutes} minutos.`
  });
}

export async function notifyInvoiceRequest(input: { orderReference: string; invoiceEmail: string }): Promise<EmailSendResult> {
  const env = getEnv();
  const from = brandedEmailFrom(env.EMAIL_FROM);

  return sendResendEmail({
    from,
    to: env.ACCOUNTING_NOTIFICATION_EMAIL || env.YOANNA_NOTIFICATION_EMAIL,
    replyTo: env.EMAIL_REPLY_TO,
    subject: "[PILULA] Nueva solicitud de factura",
    html: `<p>Nueva solicitud de factura para la orden ${input.orderReference}.</p><p>Correo factura: ${input.invoiceEmail}</p>`,
    text: `Nueva solicitud de factura para la orden ${input.orderReference}.\nCorreo factura: ${input.invoiceEmail}`
  });
}

export async function notifyManualReview(input: { orderReference: string; reason: string }): Promise<EmailSendResult> {
  const env = getEnv();
  const from = brandedEmailFrom(env.EMAIL_FROM);
  return sendResendEmail({
    from,
    to: env.YOANNA_NOTIFICATION_EMAIL,
    replyTo: env.EMAIL_REPLY_TO,
    subject: "[PILULA] Pago requiere revisión manual",
    html: `<p>Orden ${input.orderReference} requiere revisión manual.</p><p>Motivo: ${input.reason}</p>`,
    text: `Orden ${input.orderReference} requiere revisión manual.\nMotivo: ${input.reason}`
  });
}

export async function sendBankTransferInstructionsEmail(order: OrderRecord, session: Stripe.Checkout.Session): Promise<EmailSendResult> {
  const env = getEnv();
  const from = brandedEmailFrom(env.EMAIL_FROM);
  const paymentIntent = typeof session.payment_intent === "string" ? null : session.payment_intent;
  const instructions = paymentIntent?.next_action?.display_bank_transfer_instructions;
  if (!order.email || !instructions) return { sent: false, reason: "instructions_not_available" };
  return sendResendEmail({
    from,
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
}
