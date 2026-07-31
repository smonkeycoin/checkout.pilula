import { EVENT, formatMoney } from "@/config/checkout";
import { buildInvoiceLink, displayPlanName, type OrderRecord } from "@/lib/orders";

export function buildCalendarIcs() {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PILULA//HTW 2026//ES",
    "BEGIN:VEVENT",
    "UID:htw-geva-2026@pilula.com.mx",
    "DTSTAMP:20260731T000000Z",
    "DTSTART;VALUE=DATE:20261026",
    "DTEND;VALUE=DATE:20261031",
    `SUMMARY:${EVENT.program}`,
    `LOCATION:${EVENT.location}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
}

export function buyerEmail(order: OrderRecord, siteUrl: string) {
  const invoiceLink = `${siteUrl}${buildInvoiceLink(order)}`;
  const planName = displayPlanName(order.profile_type);
  const patientNote =
    order.profile_type === "patient"
      ? "<p>Este pago corresponde a un caso previamente aprobado por el equipo organizador.</p>"
      : "";

  const html = `
    <div style="font-family:Arial,sans-serif;background:#080808;color:#F8F4EA;padding:32px">
      <div style="max-width:640px;margin:auto;border:1px solid #C4A64A;padding:28px">
        <p style="color:#C4A64A;letter-spacing:0.08em">PILULA MEDPLANNER</p>
        <h1 style="font-size:24px">Pago confirmado</h1>
        <p>${order.full_name || "Gracias por tu pago"}.</p>
        <p>Referencia: <strong>${order.reference}</strong></p>
        <p>Modalidad: ${planName}</p>
        <p>Subtotal: ${formatMoney(order.amount_subtotal, order.currency)}<br/>IVA: ${formatMoney(order.amount_tax, order.currency)}<br/>Total: <strong>${formatMoney(order.amount_total, order.currency)}</strong><br/>Moneda: ${order.currency.toUpperCase()}</p>
        <p>${EVENT.program}<br/>${EVENT.dateLabel}<br/>${EVENT.location}</p>
        ${patientNote}
        <p>Stripe procesa el pago. PILULA no recibe ni almacena numeros completos de tarjeta.</p>
        <p><a href="${invoiceLink}" style="display:inline-block;background:#660033;color:#FFFFFF;padding:12px 18px;text-decoration:none">Solicitar factura</a></p>
        <p>Soporte: ${EVENT.supportEmail} · WhatsApp +52 55 3201 9586</p>
      </div>
    </div>`;

  const text = [
    "Pago confirmado · Hair Transplant Workshop 2026",
    `Nombre: ${order.full_name || ""}`,
    `Referencia: ${order.reference}`,
    `Modalidad: ${planName}`,
    `Subtotal: ${formatMoney(order.amount_subtotal, order.currency)}`,
    `IVA: ${formatMoney(order.amount_tax, order.currency)}`,
    `Total: ${formatMoney(order.amount_total, order.currency)}`,
    `Moneda: ${order.currency.toUpperCase()}`,
    `${EVENT.dateLabel} · ${EVENT.location}`,
    order.profile_type === "patient" ? "Pago de paciente previamente aprobado." : "",
    "Stripe procesa el pago. PILULA no recibe ni almacena numeros completos de tarjeta.",
    `Solicitar factura: ${invoiceLink}`,
    `Soporte: ${EVENT.supportEmail} · +52 55 3201 9586`
  ]
    .filter(Boolean)
    .join("\n");

  return { html, text };
}

export function ownerEmail(order: OrderRecord, siteUrl: string) {
  const planName = displayPlanName(order.profile_type);
  const html = `
    <div style="font-family:Arial,sans-serif;color:#171717">
      <h1>Nuevo pago confirmado · ${planName}</h1>
      <p>Referencia: ${order.reference}</p>
      <p>Nombre: ${order.full_name || ""}<br/>Perfil: ${planName}<br/>Email: ${order.email || ""}<br/>WhatsApp: ${order.phone || ""}</p>
      <p>Especialidad: ${order.specialty || ""}<br/>Ciudad: ${order.city_country || ""}</p>
      <p>Subtotal: ${formatMoney(order.amount_subtotal, order.currency)} · IVA: ${formatMoney(order.amount_tax, order.currency)} · Total: ${formatMoney(order.amount_total, order.currency)}</p>
      <p>Stripe Session ID: ${order.stripe_checkout_session_id || ""}<br/>PaymentIntent ID: ${order.stripe_payment_intent_id || ""}</p>
      <p>Factura solicitada: ${order.invoice_requested ? "si" : "no"}</p>
      <p>Registro: ${siteUrl}/factura?order=${order.id}</p>
    </div>`;
  const text = [
    `[PILULA] Nuevo pago confirmado · ${planName}`,
    `Referencia: ${order.reference}`,
    `Nombre: ${order.full_name || ""}`,
    `Perfil: ${planName}`,
    `Email: ${order.email || ""}`,
    `WhatsApp: ${order.phone || ""}`,
    `Especialidad: ${order.specialty || ""}`,
    `Ciudad: ${order.city_country || ""}`,
    `Subtotal: ${formatMoney(order.amount_subtotal, order.currency)}`,
    `IVA: ${formatMoney(order.amount_tax, order.currency)}`,
    `Total: ${formatMoney(order.amount_total, order.currency)}`,
    `Stripe Session ID: ${order.stripe_checkout_session_id || ""}`,
    `PaymentIntent ID: ${order.stripe_payment_intent_id || ""}`,
    `Factura solicitada: ${order.invoice_requested ? "si" : "no"}`
  ].join("\n");

  return { html, text };
}
