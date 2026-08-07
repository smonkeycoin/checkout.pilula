import { PROGRAM_CAPACITY, type PaymentCurrency, type PlanKey } from "@/config/checkout";
import { getEnv, getStripeEnvironment, isPlaceholder, type StripeEnvironment } from "@/lib/env";
import { PENDING_INVOICE_STATUSES, isPaidOrderStatus, isPendingOrderStatus, paymentStatusLabel } from "@/lib/admin/status";
import { redact } from "@/lib/security/text";

export type DashboardRange = "today" | "7d" | "30d" | "all";

export type DashboardOrderRow = {
  id: string;
  reference: string | null;
  profile_type: PlanKey | string | null;
  status: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_customer_id: string | null;
  environment?: StripeEnvironment | string | null;
  livemode?: boolean | null;
  is_internal_test?: boolean | null;
  excluded_from_kpis?: boolean | null;
  payment_option?: "full" | "deposit" | "balance" | string | null;
  deposit_amount?: number | null;
  balance_amount?: number | null;
  deposit_status?: string | null;
  balance_status?: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  currency: PaymentCurrency | string | null;
  payment_method: string | null;
  amount_subtotal: number | null;
  amount_tax: number | null;
  amount_total: number | null;
  amount_received: number | null;
  amount_remaining: number | null;
  payment_invite_id: string | null;
  payment_expires_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  paid_at: string | null;
};

export type DashboardInviteRow = {
  id: string;
  profile_type: PlanKey | string | null;
  status: string | null;
  environment?: StripeEnvironment | string | null;
  livemode?: boolean | null;
  is_internal_test?: boolean | null;
  excluded_from_kpis?: boolean | null;
  created_at: string | null;
  approved_at: string | null;
  opened_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
};

export type DashboardOtpRow = {
  invite_id: string | null;
  verified_at: string | null;
  created_at: string | null;
};

export type DashboardInvoiceRow = {
  id: string;
  order_id: string | null;
  status: string | null;
  created_at: string | null;
};

export type DashboardInput = {
  range: DashboardRange;
  now?: Date;
  orders: DashboardOrderRow[];
  invites: DashboardInviteRow[];
  otps: DashboardOtpRow[];
  invoices: DashboardInvoiceRow[];
};

type ChartPoint = {
  date: string;
  amount: number;
};

export type DashboardData = ReturnType<typeof buildDashboardData>;

export function dashboardSupabaseError(table: string) {
  return {
    error: "No se pudo cargar el dashboard administrativo.",
    code: "ADMIN_DASHBOARD_QUERY_FAILED",
    table
  };
}

export function parseDashboardRange(value: string | null | undefined): DashboardRange {
  return value === "today" || value === "7d" || value === "30d" || value === "all" ? value : "30d";
}

export function rangeStart(range: DashboardRange, now = new Date()) {
  if (range === "all") return null;
  const start = new Date(now);
  if (range === "today") {
    start.setHours(0, 0, 0, 0);
    return start;
  }
  start.setDate(start.getDate() - (range === "7d" ? 7 : 30));
  return start;
}

function cents(value: number | null | undefined) {
  return Number(value || 0);
}

function isCommercialKpiOrder(order: DashboardOrderRow) {
  return !order.excluded_from_kpis && !order.is_internal_test;
}

function isCommercialKpiInvite(invite: DashboardInviteRow) {
  return !invite.excluded_from_kpis && !invite.is_internal_test;
}

function dateKey(value: string | null | undefined) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function inNext48Hours(value: string | null | undefined, now: Date) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return time > now.getTime() && time <= now.getTime() + 48 * 60 * 60 * 1000;
}

function isExpiredInvite(invite: DashboardInviteRow, now: Date) {
  return invite.status === "expired" || Boolean(invite.expires_at && new Date(invite.expires_at).getTime() <= now.getTime());
}

function addChartValue(map: Map<string, number>, key: string, value: number) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + value);
}

function chartFromMap(map: Map<string, number>): ChartPoint[] {
  return [...map.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, amount]) => ({ date, amount }));
}

function latestDate(...values: Array<string | null | undefined>) {
  const dates = values.filter(Boolean).map((value) => new Date(String(value)).getTime()).filter(Number.isFinite);
  return dates.length ? new Date(Math.max(...dates)).toISOString() : null;
}

function makeActivity(eventType: string, entityType: string, entityId: string, summary: string, createdAt: string | null) {
  return { eventType, entityType, entityId, summary, createdAt };
}

export function buildDashboardData(input: DashboardInput) {
  const now = input.now || new Date();
  const commercialOrders = input.orders.filter(isCommercialKpiOrder);
  const commercialInvites = input.invites.filter(isCommercialKpiInvite);
  const paidOrders = commercialOrders.filter((order) => isPaidOrderStatus(order.status));
  const pendingOrders = commercialOrders.filter((order) => isPendingOrderStatus(order.status));
  const contractedOrders = commercialOrders.filter(
    (order) =>
      isPaidOrderStatus(order.status) ||
      order.status === "partially_funded" ||
      order.status === "partially_paid" ||
      order.deposit_status === "paid" ||
      cents(order.amount_received) > 0
  );
  const paidMxn = paidOrders.filter((order) => order.currency === "mxn");
  const paidUsd = paidOrders.filter((order) => order.currency === "usd");
  const paidInviteIds = new Set(paidOrders.map((order) => order.payment_invite_id).filter(Boolean));
  const verifiedOtpInviteIds = new Set(input.otps.filter((otp) => otp.verified_at).map((otp) => otp.invite_id).filter(Boolean));

  const totalMxn = paidMxn.reduce((sum, order) => sum + cents(order.amount_received || order.amount_total), 0);
  const totalUsd = paidUsd.reduce((sum, order) => sum + cents(order.amount_received || order.amount_total), 0);
  const contractedMxn = contractedOrders.filter((order) => order.currency === "mxn").reduce((sum, order) => sum + cents(order.amount_total), 0);
  const contractedUsd = contractedOrders.filter((order) => order.currency === "usd").reduce((sum, order) => sum + cents(order.amount_total), 0);
  const cashMxn = contractedOrders.filter((order) => order.currency === "mxn").reduce((sum, order) => sum + cents(order.amount_received), 0);
  const cashUsd = contractedOrders.filter((order) => order.currency === "usd").reduce((sum, order) => sum + cents(order.amount_received), 0);
  const receivableMxn = contractedOrders.filter((order) => order.currency === "mxn").reduce((sum, order) => sum + cents(order.amount_remaining), 0);
  const receivableUsd = contractedOrders.filter((order) => order.currency === "usd").reduce((sum, order) => sum + cents(order.amount_remaining), 0);
  const depositCount = contractedOrders.filter((order) => order.payment_option === "deposit" || order.deposit_status === "paid" || cents(order.amount_remaining) > 0).length;
  const fullPaymentCount = contractedOrders.filter((order) => cents(order.amount_remaining) === 0 && order.status === "paid").length;
  const doctorsConfirmed = contractedOrders.filter((order) => order.profile_type === "doctor").length;
  const patientsConfirmed = contractedOrders.filter((order) => order.profile_type === "patient").length;

  const approvedInvites = commercialInvites.filter((invite) => invite.status === "approved" || invite.status === "opened" || invite.status === "paid" || Boolean(invite.approved_at));
  const openedInvites = commercialInvites.filter((invite) => invite.status === "opened" || invite.status === "paid" || Boolean(invite.opened_at));
  const expiredInvites = commercialInvites.filter((invite) => isExpiredInvite(invite, now));
  const revokedInvites = commercialInvites.filter((invite) => invite.status === "revoked" || Boolean(invite.revoked_at));
  const paidInviteCount = commercialInvites.filter((invite) => invite.status === "paid" || paidInviteIds.has(invite.id)).length;
  const conversionRate = approvedInvites.length ? paidInviteCount / approvedInvites.length : 0;

  const chartMxn = new Map<string, number>();
  const chartUsd = new Map<string, number>();
  for (const order of paidOrders) {
    const key = dateKey(order.paid_at || order.updated_at || order.created_at);
    if (order.currency === "mxn") addChartValue(chartMxn, key, cents(order.amount_received || order.amount_total));
    if (order.currency === "usd") addChartValue(chartUsd, key, cents(order.amount_received || order.amount_total));
  }

  const recentPayments = commercialOrders
    .slice()
    .sort((left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime())
    .slice(0, 8)
    .map((order) => ({
      id: order.id,
      reference: order.reference || "",
      date: order.paid_at || order.created_at || "",
      name: order.full_name || "Sin nombre",
      email: order.email || "",
      phone: order.phone || "",
      profileType: order.profile_type || "",
      currency: order.currency || "",
      total: cents(order.amount_total),
      subtotal: cents(order.amount_subtotal),
      tax: cents(order.amount_tax),
      received: cents(order.amount_received),
      remaining: cents(order.amount_remaining),
      paymentMethod: order.payment_method || "",
      status: order.status || "",
      statusLabel: paymentStatusLabel(order.status),
      stripeCheckoutSessionIdRedacted: redact(order.stripe_checkout_session_id || ""),
      stripePaymentIntentIdRedacted: redact(order.stripe_payment_intent_id || ""),
      stripeCustomerIdRedacted: redact(order.stripe_customer_id || ""),
      environment: order.environment || (order.livemode ? "live" : "test"),
      livemode: Boolean(order.livemode),
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      paidAt: order.paid_at
    }));

  const actionItems = [
    ...commercialOrders
      .filter((order) => order.status === "awaiting_bank_transfer")
      .map((order) => ({ type: "payment", label: "SPEI pendiente", summary: order.reference || "Orden sin referencia", href: "/admin/pagos", priority: "medium" })),
    ...commercialOrders
      .filter((order) => order.status === "partially_funded" || order.status === "partially_paid")
      .map((order) => ({ type: "payment", label: "Pago parcial", summary: order.reference || "Orden sin referencia", href: "/admin/pagos", priority: "high" })),
    ...commercialOrders
      .filter((order) => order.status === "requires_manual_review")
      .map((order) => ({ type: "payment", label: "Revisión manual", summary: order.reference || "Orden sin referencia", href: "/admin/pagos", priority: "high" })),
    ...input.invoices
      .filter((invoice) => PENDING_INVOICE_STATUSES.has(String(invoice.status || "")))
      .map((invoice) => ({ type: "invoice", label: "Factura pendiente", summary: invoice.order_id || invoice.id, href: "/admin/facturas", priority: "medium" })),
    ...commercialInvites
      .filter((invite) => inNext48Hours(invite.expires_at, now) && invite.status !== "paid" && invite.status !== "revoked")
      .map((invite) => ({ type: "invite", label: "Invitación vence pronto", summary: invite.id, href: "/admin/invitaciones", priority: "medium" }))
  ].slice(0, 12);

  const activities = [
    ...commercialInvites.map((invite) => makeActivity("invite_created", "payment_invite", invite.id, "Invitación creada", invite.created_at)),
    ...commercialInvites.filter((invite) => invite.opened_at).map((invite) => makeActivity("invite_opened", "payment_invite", invite.id, "Invitación abierta", invite.opened_at)),
    ...commercialInvites.filter((invite) => invite.revoked_at).map((invite) => makeActivity("invite_revoked", "payment_invite", invite.id, "Invitación revocada", invite.revoked_at)),
    ...input.otps.filter((otp) => otp.verified_at && otp.invite_id && commercialInvites.some((invite) => invite.id === otp.invite_id)).map((otp) => makeActivity("otp_verified", "payment_invite", String(otp.invite_id), "OTP verificado", otp.verified_at)),
    ...commercialOrders.map((order) => makeActivity("checkout_started", "order", order.id, `Checkout iniciado ${order.reference || ""}`.trim(), order.created_at)),
    ...paidOrders.map((order) => makeActivity("payment_confirmed", "order", order.id, `Pago confirmado ${order.reference || ""}`.trim(), order.paid_at || order.updated_at)),
    ...input.invoices.map((invoice) => makeActivity("invoice_requested", "invoice_request", invoice.id, "Solicitud de factura", invoice.created_at))
  ]
    .filter((activity) => activity.createdAt)
    .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())
    .slice(0, 10);

  const paymentMethods = {
    card: {
      count: commercialOrders.filter((order) => order.payment_method === "card").length,
      mxn: commercialOrders.filter((order) => order.payment_method === "card" && order.currency === "mxn").reduce((sum, order) => sum + cents(order.amount_total), 0),
      usd: commercialOrders.filter((order) => order.payment_method === "card" && order.currency === "usd").reduce((sum, order) => sum + cents(order.amount_total), 0)
    },
    spei: {
      count: commercialOrders.filter((order) => order.payment_method === "bank_transfer").length,
      mxn: commercialOrders.filter((order) => order.payment_method === "bank_transfer" && order.currency === "mxn").reduce((sum, order) => sum + cents(order.amount_total), 0),
      usd: commercialOrders.filter((order) => order.payment_method === "bank_transfer" && order.currency === "usd").reduce((sum, order) => sum + cents(order.amount_total), 0)
    },
    currency: {
      mxn: { count: commercialOrders.filter((order) => order.currency === "mxn").length, amount: commercialOrders.filter((order) => order.currency === "mxn").reduce((sum, order) => sum + cents(order.amount_total), 0) },
      usd: { count: commercialOrders.filter((order) => order.currency === "usd").length, amount: commercialOrders.filter((order) => order.currency === "usd").reduce((sum, order) => sum + cents(order.amount_total), 0) }
    }
  };

  const env = getEnv();
  const stripeEnvironment = getStripeEnvironment(env.STRIPE_SECRET_KEY);
  return {
    range: input.range,
    generatedAt: now.toISOString(),
    summary: {
      totalMxn,
      totalUsd,
      contractedMxn,
      contractedUsd,
      cashMxn,
      cashUsd,
      receivableMxn,
      receivableUsd,
      depositCount,
      fullPaymentCount,
      orderCount: contractedOrders.length,
      paidCustomerCount: new Set(contractedOrders.map((order) => order.email || order.stripe_customer_id || order.id)).size,
      paidCount: paidOrders.length,
      pendingCount: pendingOrders.length,
      doctorsConfirmed,
      patientsConfirmed
    },
    capacity: {
      doctors: { confirmed: doctorsConfirmed, capacity: PROGRAM_CAPACITY.doctor },
      patients: { confirmed: patientsConfirmed, capacity: PROGRAM_CAPACITY.patient }
    },
    funnel: {
      created: commercialInvites.length,
      approved: approvedInvites.length,
      opened: openedInvites.length,
      otpVerified: verifiedOtpInviteIds.size,
      checkoutStarted: commercialOrders.length,
      paid: paidInviteCount,
      expired: expiredInvites.length,
      revoked: revokedInvites.length,
      conversionRate
    },
    recentPayments,
    actionItems,
    activity: activities,
    paymentMethods,
    integrations: {
      stripe: isPlaceholder(env.STRIPE_SECRET_KEY) ? "pending" : stripeEnvironment === "live" ? "operational" : "test_mode",
      supabase: env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY ? "operational" : "pending",
      resend: env.RESEND_API_KEY ? "operational" : "pending",
      legal: env.LEGAL_APPROVED === "true" ? "operational" : "legal_pending"
    },
    environment: {
      stripe: stripeEnvironment || "unconfigured",
      livemode: stripeEnvironment === "live",
      filteredByRuntime: Boolean(stripeEnvironment)
    },
    chart: {
      mxn: chartFromMap(chartMxn),
      usd: chartFromMap(chartUsd)
    },
    measurementNotes: {
      activity: "Actividad derivada de timestamps existentes; no hay bitácora histórica de cada transición.",
      funnel: "OTP verificado se mide por payment_invite_otps. No se mide entrega de correo ni lectura de email."
    },
    lastDataAt: latestDate(
      ...input.orders.flatMap((order) => [order.created_at, order.updated_at, order.paid_at]),
      ...input.invites.flatMap((invite) => [invite.created_at, invite.opened_at, invite.revoked_at]),
      ...input.invoices.map((invoice) => invoice.created_at)
    )
  };
}
