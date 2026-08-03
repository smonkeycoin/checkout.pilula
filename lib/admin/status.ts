export type PaymentVisualStatus =
  | "paid"
  | "awaiting_bank_transfer"
  | "partial"
  | "manual_review"
  | "failed"
  | "refunded"
  | "pending";

export const PAID_ORDER_STATUSES = new Set(["paid", "succeeded", "completed"]);
export const PENDING_ORDER_STATUSES = new Set([
  "awaiting_payment",
  "awaiting_payment_method",
  "awaiting_bank_transfer",
  "partially_paid",
  "partially_funded",
  "requires_manual_review"
]);
export const FAILED_ORDER_STATUSES = new Set(["failed", "expired", "cancelled"]);
export const REFUNDED_ORDER_STATUSES = new Set(["refunded", "disputed"]);

export const PENDING_INVOICE_STATUSES = new Set(["solicitada", "en_revision", "requiere_correccion"]);

export function isPaidOrderStatus(status: string | null | undefined) {
  return PAID_ORDER_STATUSES.has(String(status || "").toLowerCase());
}

export function isPendingOrderStatus(status: string | null | undefined) {
  return PENDING_ORDER_STATUSES.has(String(status || "").toLowerCase());
}

export function normalizePaymentStatus(status: string | null | undefined): PaymentVisualStatus {
  const value = String(status || "").toLowerCase();
  if (PAID_ORDER_STATUSES.has(value)) return "paid";
  if (value === "awaiting_bank_transfer") return "awaiting_bank_transfer";
  if (value === "partially_funded" || value === "partially_paid") return "partial";
  if (value === "requires_manual_review") return "manual_review";
  if (REFUNDED_ORDER_STATUSES.has(value)) return "refunded";
  if (FAILED_ORDER_STATUSES.has(value)) return "failed";
  return "pending";
}

export function paymentStatusLabel(status: string | null | undefined) {
  const normalized = normalizePaymentStatus(status);
  return {
    paid: "Pagado",
    awaiting_bank_transfer: "Pendiente SPEI",
    partial: "Parcial",
    manual_review: "Revisión manual",
    failed: "Fallido",
    refunded: "Reembolsado",
    pending: "Pendiente"
  }[normalized];
}
