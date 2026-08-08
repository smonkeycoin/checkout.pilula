import type { PaymentCurrency, PlanKey } from "@/config/checkout";

export type PaymentOption = "full" | "deposit";

export type OrderAmounts = {
  amount_subtotal: number;
  amount_tax: number;
  amount_total: number;
};

export type OrderFinancials = {
  payment_option: PaymentOption;
  total_amount: number;
  deposit_amount: number | null;
  balance_amount: number;
  amount_paid: number;
  amount_due: number;
  amount_received: number;
  amount_remaining: number;
  deposit_status: "not_applicable" | "pending" | "paid";
  balance_status: "not_applicable" | "pending" | "paid";
  deposit_paid_at: string | null;
  balance_paid_at: string | null;
  reminder_at: string | null;
  balance_due_at: string | null;
};

export type PaymentLinkResolution = {
  participantType: PlanKey;
  paymentOption: PaymentOption;
  currency: PaymentCurrency;
  amounts: OrderAmounts;
};

function halfUp(value: number) {
  return Math.round(value / 2);
}

export function getCheckoutChargeAmounts(paymentOption: PaymentOption, amounts: OrderAmounts) {
  if (paymentOption === "full") return amounts;
  const amount_subtotal = halfUp(amounts.amount_subtotal);
  const amount_tax = halfUp(amounts.amount_tax);
  return {
    amount_subtotal,
    amount_tax,
    amount_total: amount_subtotal + amount_tax
  };
}

export function buildInitialOrderFinancials(paymentOption: PaymentOption, amounts: OrderAmounts): OrderFinancials {
  const charge = getCheckoutChargeAmounts(paymentOption, amounts);
  const balanceAmount = paymentOption === "deposit" ? Math.max(amounts.amount_total - charge.amount_total, 0) : 0;

  return {
    payment_option: paymentOption,
    total_amount: amounts.amount_total,
    deposit_amount: paymentOption === "deposit" ? charge.amount_total : null,
    balance_amount: balanceAmount,
    amount_paid: 0,
    amount_due: amounts.amount_total,
    amount_received: 0,
    amount_remaining: amounts.amount_total,
    deposit_status: paymentOption === "deposit" ? "pending" : "not_applicable",
    balance_status: paymentOption === "deposit" ? "pending" : "not_applicable",
    deposit_paid_at: null,
    balance_paid_at: null,
    reminder_at: null,
    balance_due_at: null
  };
}

export function buildPaidOrderFinancials(paymentOption: PaymentOption, amounts: OrderAmounts, paidAt: Date): OrderFinancials {
  const charge = getCheckoutChargeAmounts(paymentOption, amounts);
  const paidAtIso = paidAt.toISOString();
  const balanceAmount = paymentOption === "deposit" ? Math.max(amounts.amount_total - charge.amount_total, 0) : 0;

  return {
    payment_option: paymentOption,
    total_amount: amounts.amount_total,
    deposit_amount: paymentOption === "deposit" ? charge.amount_total : null,
    balance_amount: balanceAmount,
    amount_paid: paymentOption === "deposit" ? charge.amount_total : amounts.amount_total,
    amount_due: paymentOption === "deposit" ? balanceAmount : 0,
    amount_received: paymentOption === "deposit" ? charge.amount_total : amounts.amount_total,
    amount_remaining: paymentOption === "deposit" ? balanceAmount : 0,
    deposit_status: paymentOption === "deposit" ? "paid" : "not_applicable",
    balance_status: paymentOption === "deposit" ? "pending" : "not_applicable",
    deposit_paid_at: paymentOption === "deposit" ? paidAtIso : null,
    balance_paid_at: null,
    reminder_at: paymentOption === "deposit" ? new Date(paidAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString() : null,
    balance_due_at: paymentOption === "deposit" ? new Date(paidAt.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString() : null
  };
}

export function buildBalancePaidFinancials(order: {
  amount_total: number;
  amount_received?: number | null;
  amount_remaining?: number | null;
  balance_amount?: number | null;
}, balancePaid: number, paidAt: Date) {
  const amountPaid = Math.min((order.amount_received || 0) + balancePaid, order.amount_total);
  return {
    amount_paid: amountPaid,
    amount_due: 0,
    amount_received: amountPaid,
    amount_remaining: 0,
    balance_status: "paid" as const,
    balance_paid_at: paidAt.toISOString()
  };
}

