"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, FileText, LayoutDashboard, LogOut, RefreshCw, Settings, Ticket, Wallet } from "lucide-react";
import { formatMoney, type PaymentCurrency } from "@/config/checkout";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Row = Record<string, unknown>;

type DashboardPayload = {
  range: DashboardRange;
  generatedAt: string;
  lastDataAt: string | null;
  summary: {
    totalMxn: number;
    totalUsd: number;
    paidCount: number;
    pendingCount: number;
    doctorsConfirmed: number;
    patientsConfirmed: number;
  };
  capacity: {
    doctors: { confirmed: number; capacity: number };
    patients: { confirmed: number; capacity: number };
  };
  funnel: {
    created: number;
    approved: number;
    opened: number;
    otpVerified: number;
    checkoutStarted: number;
    paid: number;
    expired: number;
    revoked: number;
    conversionRate: number;
  };
  recentPayments: DashboardPayment[];
  actionItems: Array<{ type: string; label: string; summary: string; href: string; priority: string }>;
  activity: Array<{ eventType: string; entityType: string; entityId: string; summary: string; createdAt: string }>;
  paymentMethods: {
    card: { count: number; mxn: number; usd: number };
    spei: { count: number; mxn: number; usd: number };
    currency: { mxn: { count: number; amount: number }; usd: { count: number; amount: number } };
  };
  integrations: Record<string, "operational" | "pending" | "test_mode" | "legal_pending">;
  chart: {
    mxn: Array<{ date: string; amount: number }>;
    usd: Array<{ date: string; amount: number }>;
  };
  measurementNotes: Record<string, string>;
};

type DashboardPayment = {
  id: string;
  reference: string;
  date: string;
  name: string;
  email: string;
  phone: string;
  profileType: string;
  currency: PaymentCurrency | string;
  total: number;
  subtotal: number;
  tax: number;
  received: number;
  remaining: number;
  paymentMethod: string;
  status: string;
  statusLabel: string;
  stripeCheckoutSessionIdRedacted: string;
  stripePaymentIntentIdRedacted: string;
  stripeCustomerIdRedacted: string;
  createdAt: string | null;
  updatedAt: string | null;
  paidAt: string | null;
};

type DashboardRange = "today" | "7d" | "30d" | "all";

function useSupabase() {
  return useMemo(() => createSupabaseBrowserClient(), []);
}

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useSupabase();
  const items = [
    { href: "/admin", label: "Resumen", icon: LayoutDashboard },
    { href: "/admin/invitaciones", label: "Invitaciones", icon: Ticket },
    { href: "/admin/pagos", label: "Pagos", icon: Wallet },
    { href: "/admin/facturas", label: "Facturas", icon: FileText },
    { href: "/admin/configuracion/precios", label: "Precios", icon: Settings }
  ];

  async function signOut() {
    await supabase?.auth.signOut();
    router.push("/admin/login");
  }

  return (
    <nav className="grid gap-4 text-sm text-pilula-ivory/75 lg:sticky lg:top-6">
      <div className="border border-pilula-gold/20 bg-pilula-charcoal p-4">
        <p className="text-base font-semibold text-pilula-ivory">PÍLULA MedPlanner</p>
        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-pilula-gold">Panel administrativo</p>
      </div>
      <div className="flex gap-2 overflow-x-auto lg:grid lg:overflow-visible">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              className={`inline-flex min-h-11 min-w-max items-center gap-2 border px-3 py-2 transition lg:w-full ${
                active
                  ? "border-pilula-gold/55 bg-pilula-gold/10 text-pilula-gold"
                  : "border-pilula-gold/15 bg-pilula-charcoal/80 hover:border-pilula-gold/35 hover:text-pilula-gold"
              }`}
              href={item.href}
              key={item.href}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </div>
      <button
        className="inline-flex min-h-11 items-center justify-center gap-2 border border-pilula-gold/15 bg-pilula-black px-3 text-pilula-ivory/75 hover:border-pilula-gold/35 hover:text-pilula-gold"
        type="button"
        onClick={signOut}
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        Cerrar sesión
      </button>
    </nav>
  );
}

export function DashboardAdmin({ initialRange = "30d" }: { initialRange?: DashboardRange }) {
  const supabase = useSupabase();
  const router = useRouter();
  const [range, setRange] = useState<DashboardRange>(initialRange);
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<DashboardPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/dashboard?range=${range}`, { headers: await authHeader(supabase) });
      const payload = (await response.json()) as DashboardPayload | { error?: string };
      if (!response.ok) throw new Error("error" in payload && payload.error ? payload.error : "No se pudo cargar el dashboard.");
      setData(payload as DashboardPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el dashboard.");
    } finally {
      setLoading(false);
    }
  }, [range, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  function changeRange(nextRange: DashboardRange) {
    setRange(nextRange);
    router.replace(`/admin?range=${nextRange}`);
  }

  if (loading && !data) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <DashboardHeader
        data={data}
        error={error}
        loading={loading}
        range={range}
        onRefresh={load}
        onRangeChange={changeRange}
      />
      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-pilula-burgundy/50 bg-pilula-burgundy/15 p-4 text-sm">
          <span>{error}</span>
          <button className="min-h-11 border border-pilula-gold/30 px-4" type="button" onClick={load}>Reintentar</button>
        </div>
      ) : null}
      {data ? (
        <>
          <KpiGrid data={data} />
          <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
            <CapacityPanel data={data} />
            <RevenueChart data={data} />
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <FunnelPanel data={data} />
            <ActionItemsPanel items={data.actionItems} />
          </div>
          <RecentPayments payments={data.recentPayments} onSelect={setSelectedPayment} />
          <div className="grid gap-6 xl:grid-cols-2">
            <PaymentMethodsPanel data={data} />
            <ActivityPanel data={data} />
          </div>
          <IntegrationsPanel data={data} />
          <NotesPanel notes={data.measurementNotes} />
          {selectedPayment ? <PaymentDetail payment={selectedPayment} onClose={() => setSelectedPayment(null)} /> : null}
        </>
      ) : null}
    </div>
  );
}

export function parseRange(value: string | null | undefined): DashboardRange {
  return value === "today" || value === "7d" || value === "30d" || value === "all" ? value : "30d";
}

function DashboardHeader({
  data,
  error,
  loading,
  range,
  onRefresh,
  onRangeChange
}: {
  data: DashboardPayload | null;
  error: string;
  loading: boolean;
  range: DashboardRange;
  onRefresh: () => void;
  onRangeChange: (range: DashboardRange) => void;
}) {
  const ranges: Array<{ value: DashboardRange; label: string }> = [
    { value: "today", label: "Hoy" },
    { value: "7d", label: "Últimos 7 días" },
    { value: "30d", label: "Últimos 30 días" },
    { value: "all", label: "Todo" }
  ];
  return (
    <section className="border border-pilula-gold/15 bg-pilula-charcoal p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal text-pilula-ivory md:text-4xl">Resumen operativo</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-pilula-ivory/70">
            Cobros, lugares e invitaciones de PÍLULA MedPlanner.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-pilula-ivory/65">
            <span className="border border-pilula-gold/20 px-3 py-1">Actualizado: {formatDateTime(data?.generatedAt)}</span>
            {data?.integrations.stripe === "test_mode" ? <span className="border border-pilula-gold/40 px-3 py-1 text-pilula-gold">Stripe Test</span> : null}
            {error ? <span className="border border-pilula-burgundy/50 px-3 py-1 text-pilula-ivory">Revisión requerida</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex min-h-11 overflow-hidden border border-pilula-gold/20">
            {ranges.map((item) => (
              <button
                className={`px-3 text-sm ${range === item.value ? "bg-pilula-gold/15 text-pilula-gold" : "text-pilula-ivory/70 hover:text-pilula-gold"}`}
                key={item.value}
                type="button"
                onClick={() => onRangeChange(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            className="inline-flex min-h-11 items-center gap-2 bg-pilula-burgundy px-4 text-sm font-semibold text-white disabled:opacity-60"
            type="button"
            disabled={loading}
            onClick={onRefresh}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Actualizar
          </button>
        </div>
      </div>
    </section>
  );
}

function KpiGrid({ data }: { data: DashboardPayload }) {
  const cards = [
    { label: "Cobrado total MXN", value: money(data.summary.totalMxn, "mxn") },
    { label: "Cobrado total USD", value: money(data.summary.totalUsd, "usd") },
    { label: "Pagos confirmados", value: String(data.summary.paidCount) },
    { label: "Pendientes", value: String(data.summary.pendingCount) },
    { label: "Lugares médicos confirmados", value: String(data.summary.doctorsConfirmed) },
    { label: "Pacientes confirmados", value: String(data.summary.patientsConfirmed) }
  ];
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <article className="border border-pilula-gold/15 bg-pilula-charcoal p-5" key={card.label}>
          <p className="text-xs uppercase tracking-[0.18em] text-pilula-gold/85">{card.label}</p>
          <p className="mt-4 text-3xl font-semibold text-pilula-ivory">{card.value}</p>
        </article>
      ))}
    </section>
  );
}

function CapacityPanel({ data }: { data: DashboardPayload }) {
  return (
    <section className="border border-pilula-gold/15 bg-pilula-charcoal p-5">
      <h2 className="text-xl font-semibold">Cupos del programa</h2>
      <div className="mt-5 grid gap-5">
        <CapacityBar label="Médicos" confirmed={data.capacity.doctors.confirmed} capacity={data.capacity.doctors.capacity} />
        <CapacityBar label="Pacientes" confirmed={data.capacity.patients.confirmed} capacity={data.capacity.patients.capacity} />
      </div>
    </section>
  );
}

function CapacityBar({ label, confirmed, capacity }: { label: string; confirmed: number; capacity: number }) {
  const exceeded = confirmed > capacity;
  const percentage = capacity ? Math.min(100, Math.round((confirmed / capacity) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className={exceeded ? "text-pilula-burgundy" : "text-pilula-ivory/75"}>{confirmed} / {capacity}</span>
      </div>
      <div className="mt-2 h-3 bg-pilula-black">
        <div className={`h-full ${exceeded ? "bg-pilula-burgundy" : "bg-pilula-gold"}`} style={{ width: `${percentage}%` }} />
      </div>
      {exceeded ? (
        <p className="mt-2 inline-flex items-center gap-2 text-sm text-pilula-burgundy">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          Cupo excedido; revisar operación.
        </p>
      ) : null}
    </div>
  );
}

function FunnelPanel({ data }: { data: DashboardPayload }) {
  const steps = [
    ["Invitaciones creadas", data.funnel.created],
    ["Aprobadas", data.funnel.approved],
    ["Abiertas", data.funnel.opened],
    ["OTP verificado", data.funnel.otpVerified],
    ["Checkout iniciado", data.funnel.checkoutStarted],
    ["Pagadas", data.funnel.paid],
    ["Vencidas", data.funnel.expired],
    ["Revocadas", data.funnel.revoked]
  ] as const;
  const max = Math.max(...steps.map(([, value]) => value), 1);
  return (
    <section className="border border-pilula-gold/15 bg-pilula-charcoal p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Embudo de conversión</h2>
          <p className="mt-1 text-sm text-pilula-ivory/60">Conversión pagadas / aprobadas: {percent(data.funnel.conversionRate)}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3">
        {steps.map(([label, value]) => (
          <div className="grid gap-2 sm:grid-cols-[170px_1fr_54px] sm:items-center" key={label}>
            <span className="text-sm text-pilula-ivory/72">{label}</span>
            <div className="h-3 bg-pilula-black">
              <div className="h-full bg-pilula-gold" style={{ width: `${Math.max(4, Math.round((value / max) * 100))}%` }} />
            </div>
            <span className="text-right text-sm font-semibold">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function RevenueChart({ data }: { data: DashboardPayload }) {
  const points = [...data.chart.mxn, ...data.chart.usd];
  const max = Math.max(...points.map((point) => point.amount), 1);
  const labels = [...new Set(points.map((point) => point.date))].sort();
  return (
    <section className="border border-pilula-gold/15 bg-pilula-charcoal p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Cobros por día</h2>
        <div className="flex gap-3 text-xs text-pilula-ivory/65">
          <span className="inline-flex items-center gap-1"><i className="h-2 w-2 bg-pilula-gold" /> MXN</span>
          <span className="inline-flex items-center gap-1"><i className="h-2 w-2 bg-pilula-burgundy" /> USD</span>
        </div>
      </div>
      {labels.length ? (
        <div className="mt-5 grid min-h-[210px] grid-cols-[48px_1fr] gap-3">
          <div className="flex flex-col justify-between text-xs text-pilula-ivory/45">
            <span>{compactAmount(max)}</span>
            <span>{compactAmount(Math.round(max / 2))}</span>
            <span>0</span>
          </div>
          <div className="flex items-end gap-2 overflow-x-auto border-l border-b border-pilula-gold/15 px-3 pb-2">
            {labels.map((label) => {
              const mxn = data.chart.mxn.find((point) => point.date === label)?.amount || 0;
              const usd = data.chart.usd.find((point) => point.date === label)?.amount || 0;
              return (
                <div className="grid min-w-12 gap-2" key={label}>
                  <div className="flex h-36 items-end justify-center gap-1">
                    <div className="w-4 bg-pilula-gold" style={{ height: `${Math.max(2, (mxn / max) * 100)}%` }} title={`MXN ${mxn}`} />
                    <div className="w-4 bg-pilula-burgundy" style={{ height: `${Math.max(2, (usd / max) * 100)}%` }} title={`USD ${usd}`} />
                  </div>
                  <span className="truncate text-center text-[10px] text-pilula-ivory/45">{label.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState text="Sin cobros confirmados en este rango." />
      )}
    </section>
  );
}

function RecentPayments({ payments, onSelect }: { payments: DashboardPayment[]; onSelect: (payment: DashboardPayment) => void }) {
  return (
    <section className="border border-pilula-gold/15 bg-pilula-charcoal p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Ingresos recientes</h2>
        <Link className="inline-flex min-h-11 items-center gap-2 border border-pilula-gold/25 px-3 text-sm text-pilula-ivory/75 hover:text-pilula-gold" href="/admin/pagos">
          Ver pagos <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      {payments.length ? (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[940px] text-left text-sm">
            <thead className="text-pilula-gold">
              <tr><th className="py-2">fecha</th><th>nombre</th><th>modalidad</th><th>moneda</th><th>total</th><th>método</th><th>estado</th><th>referencia</th></tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr className="cursor-pointer border-t border-pilula-gold/10 hover:bg-pilula-gold/5" key={payment.id} onClick={() => onSelect(payment)}>
                  <td className="py-3 text-pilula-ivory/65">{formatDate(payment.date)}</td>
                  <td>{payment.name}</td>
                  <td>{payment.profileType === "doctor" ? "Médico" : "Paciente"}</td>
                  <td>{String(payment.currency).toUpperCase()}</td>
                  <td>{money(payment.total, payment.currency)}</td>
                  <td>{payment.paymentMethod === "bank_transfer" ? "SPEI" : "Tarjeta"}</td>
                  <td><StatusPill label={payment.statusLabel} status={payment.status} /></td>
                  <td className="font-mono text-xs text-pilula-ivory/60">{payment.reference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState text="Sin pagos en este rango." />
      )}
    </section>
  );
}

function ActionItemsPanel({ items }: { items: DashboardPayload["actionItems"] }) {
  return (
    <section className="border border-pilula-gold/15 bg-pilula-charcoal p-5">
      <h2 className="text-xl font-semibold">Pendientes que requieren acción</h2>
      <div className="mt-5 grid gap-3">
        {items.length ? items.map((item, index) => (
          <div className="flex flex-wrap items-center justify-between gap-3 border border-pilula-gold/10 bg-pilula-black/40 p-3" key={`${item.type}-${item.summary}-${index}`}>
            <div>
              <p className={item.priority === "high" ? "font-semibold text-pilula-burgundy" : "font-semibold"}>{item.label}</p>
              <p className="mt-1 text-sm text-pilula-ivory/60">{item.summary}</p>
            </div>
            <Link className="inline-flex min-h-11 items-center border border-pilula-gold/25 px-3 text-sm hover:text-pilula-gold" href={item.href}>
              {item.type === "payment" ? "Ver pago" : item.type === "invoice" ? "Ver factura" : "Ver invitación"}
            </Link>
          </div>
        )) : <EmptyState text="Todo al día." />}
      </div>
    </section>
  );
}

function PaymentMethodsPanel({ data }: { data: DashboardPayload }) {
  const rows = [
    ["Tarjeta", data.paymentMethods.card.count, data.paymentMethods.card.mxn, data.paymentMethods.card.usd],
    ["SPEI", data.paymentMethods.spei.count, data.paymentMethods.spei.mxn, data.paymentMethods.spei.usd],
    ["MXN", data.paymentMethods.currency.mxn.count, data.paymentMethods.currency.mxn.amount, null],
    ["USD", data.paymentMethods.currency.usd.count, null, data.paymentMethods.currency.usd.amount]
  ] as const;
  return (
    <section className="border border-pilula-gold/15 bg-pilula-charcoal p-5">
      <h2 className="text-xl font-semibold">Métodos de pago</h2>
      <div className="mt-5 grid gap-3">
        {rows.map(([label, count, mxn, usd]) => (
          <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-pilula-gold/10 pb-3 text-sm" key={label}>
            <span>{label}</span>
            <span className="text-pilula-ivory/60">{count} registros</span>
            <span className="text-pilula-ivory/55">MXN</span>
            <span>{mxn === null ? "No aplica" : money(mxn, "mxn")}</span>
            <span className="text-pilula-ivory/55">USD</span>
            <span>{usd === null ? "No aplica" : money(usd, "usd")}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ActivityPanel({ data }: { data: DashboardPayload }) {
  return (
    <section className="border border-pilula-gold/15 bg-pilula-charcoal p-5">
      <h2 className="text-xl font-semibold">Actividad reciente</h2>
      <div className="mt-5 grid gap-3">
        {data.activity.length ? data.activity.map((activity) => (
          <div className="border-l border-pilula-gold/35 pl-3" key={`${activity.eventType}-${activity.entityId}-${activity.createdAt}`}>
            <p className="text-sm font-semibold">{activity.summary}</p>
            <p className="mt-1 text-xs text-pilula-ivory/55">{formatDateTime(activity.createdAt)} · {activity.entityType}</p>
          </div>
        )) : <EmptyState text="Sin actividad registrada en este rango." />}
      </div>
    </section>
  );
}

function IntegrationsPanel({ data }: { data: DashboardPayload }) {
  const labels: Record<string, string> = {
    stripe: "Stripe",
    supabase: "Supabase",
    resend: "Resend",
    legal: "Legales"
  };
  const statusText = {
    operational: "Operativo",
    pending: "Pendiente",
    test_mode: "Modo prueba",
    legal_pending: "Legales pendientes de aprobación"
  };
  return (
    <section className="border border-pilula-gold/15 bg-pilula-charcoal p-5">
      <h2 className="text-xl font-semibold">Estado de integraciones</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(data.integrations).map(([key, value]) => (
          <div className="border border-pilula-gold/10 bg-pilula-black/40 p-3" key={key}>
            <p className="text-sm text-pilula-ivory/65">{labels[key] || key}</p>
            <p className={value === "pending" || value === "legal_pending" ? "mt-2 font-semibold text-pilula-gold" : "mt-2 font-semibold"}>
              {statusText[value]}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function NotesPanel({ notes }: { notes: Record<string, string> }) {
  return (
    <section className="border border-pilula-gold/15 bg-pilula-charcoal p-5 text-sm text-pilula-ivory/65">
      <h2 className="text-base font-semibold text-pilula-ivory">Campos sin medición histórica completa</h2>
      <ul className="mt-3 grid gap-2">
        {Object.entries(notes).map(([key, note]) => <li key={key}>{note}</li>)}
      </ul>
    </section>
  );
}

function PaymentDetail({ payment, onClose }: { payment: DashboardPayment; onClose: () => void }) {
  const rows = [
    ["Referencia", payment.reference],
    ["Email", payment.email || "Sin email"],
    ["WhatsApp", payment.phone || "Sin WhatsApp"],
    ["Subtotal", money(payment.subtotal, payment.currency)],
    ["IVA", money(payment.tax, payment.currency)],
    ["Total", money(payment.total, payment.currency)],
    ["Recibido", money(payment.received, payment.currency)],
    ["Saldo", money(payment.remaining, payment.currency)],
    ["Checkout", payment.stripeCheckoutSessionIdRedacted || "No registrado"],
    ["PaymentIntent", payment.stripePaymentIntentIdRedacted || "No registrado"],
    ["Customer", payment.stripeCustomerIdRedacted || "No registrado"],
    ["Creado", formatDateTime(payment.createdAt)],
    ["Actualizado", formatDateTime(payment.updatedAt)],
    ["Pagado", formatDateTime(payment.paidAt)]
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-4 md:items-center md:justify-end" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full overflow-y-auto border border-pilula-gold/25 bg-pilula-charcoal p-5 shadow-gold md:max-w-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-pilula-gold">Detalle de pago</p>
            <h3 className="mt-2 text-2xl font-semibold">{payment.name}</h3>
          </div>
          <button className="min-h-11 border border-pilula-gold/25 px-3 text-sm" type="button" onClick={onClose}>Cerrar</button>
        </div>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div className="border border-pilula-gold/10 bg-pilula-black/30 p-3" key={label}>
              <dt className="text-pilula-ivory/45">{label}</dt>
              <dd className="mt-1 break-all">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function StatusPill({ label, status }: { label: string; status: string }) {
  const attention = status === "requires_manual_review" || status === "failed" || status === "refunded";
  return (
    <span className={`inline-flex border px-2 py-1 text-xs ${attention ? "border-pilula-burgundy/50 text-pilula-burgundy" : "border-pilula-gold/25 text-pilula-ivory/75"}`}>
      {label}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="mt-5 border border-pilula-gold/10 bg-pilula-black/30 p-4 text-sm text-pilula-ivory/60">{text}</p>;
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-4">
      {Array.from({ length: 8 }).map((_, index) => <div className="h-28 animate-pulse bg-pilula-charcoal" key={index} />)}
    </div>
  );
}

function money(value: number, currency: string | null | undefined) {
  const safeCurrency = currency === "usd" || currency === "mxn" ? currency : "mxn";
  return formatMoney(value, safeCurrency);
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function compactAmount(value: number) {
  return new Intl.NumberFormat("es-MX", { notation: "compact", maximumFractionDigits: 1 }).format(value / 100);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Sin datos";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function AdminLogin({ errorMessage }: { errorMessage?: string }) {
  const supabase = useSupabase();
  const [email, setEmail] = useState("pilulamedplanner@gmail.com");
  const [message, setMessage] = useState(errorMessage || "");

  async function continueWithGoogle() {
    if (!supabase) {
      setMessage("Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
    if (error) setMessage("No se pudo iniciar sesión con Google.");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setMessage("Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/admin` }
    });
    setMessage(error ? "No se pudo enviar el magic link." : "Revisa tu correo para abrir el panel.");
  }

  return (
    <div className="mt-8 grid max-w-md gap-5">
      <button
        className="inline-flex min-h-11 items-center justify-center bg-pilula-burgundy px-5 text-sm font-semibold text-white hover:bg-[#7A0A40]"
        type="button"
        onClick={continueWithGoogle}
      >
        Continuar con Google
      </button>

      <form onSubmit={submit} className="grid gap-3 border border-pilula-gold/15 p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-pilula-gold">Respaldo</p>
        <label className="grid gap-2 text-sm text-pilula-ivory/75">
          Magic link
          <input className="min-h-11 border border-pilula-gold/25 bg-pilula-black px-3 text-pilula-ivory" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <button className="min-h-11 border border-pilula-gold/30 px-5 text-sm font-semibold text-pilula-ivory" type="submit">Enviar magic link</button>
      </form>

      {message ? <p className="text-sm text-pilula-ivory/75">{message}</p> : null}
    </div>
  );
}

async function authHeader(supabase: SupabaseClient | null): Promise<Record<string, string>> {
  const session = await supabase?.auth.getSession();
  const token = session?.data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function InvitationsAdmin() {
  const supabase = useSupabase();
  const [rows, setRows] = useState<Row[]>([]);
  const [createdUrl, setCreatedUrl] = useState("");
  const [form, setForm] = useState({
    profileType: "doctor",
    market: "mexico",
    paymentCurrency: "mxn",
    allowedPaymentMethods: "card_and_bank_transfer",
    exchangeRate: "",
    fullName: "",
    email: "",
    whatsapp: "",
    expiresAt: new Date(Date.now() + 7 * 24 * 3600_000).toISOString().slice(0, 16),
    approved: true,
    sendEmail: false
  });

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/invites", { headers: await authHeader(supabase) });
    if (response.ok) setRows(((await response.json()) as { invites: Row[] }).invites || []);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/admin/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader(supabase)) },
      body: JSON.stringify({ ...form, expiresAt: new Date(form.expiresAt).toISOString() })
    });
    if (response.ok) {
      const payload = (await response.json()) as { url: string };
      setCreatedUrl(payload.url);
      await load();
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={create} className="grid gap-4 border border-pilula-gold/25 p-5 md:grid-cols-2">
        <select className="min-h-11 bg-pilula-black px-3" value={form.profileType} onChange={(event) => setForm({ ...form, profileType: event.target.value })}>
          <option value="doctor">Doctor</option>
          <option value="patient">Paciente</option>
        </select>
        <select className="min-h-11 bg-pilula-black px-3" value={form.market} onChange={(event) => setForm({ ...form, market: event.target.value })}>
          <option value="mexico">México</option>
          <option value="international">Internacional</option>
        </select>
        <select className="min-h-11 bg-pilula-black px-3" value={form.paymentCurrency} onChange={(event) => setForm({ ...form, paymentCurrency: event.target.value })}>
          <option value="mxn">MXN</option>
          <option value="usd">USD</option>
        </select>
        <select className="min-h-11 bg-pilula-black px-3" value={form.allowedPaymentMethods} onChange={(event) => setForm({ ...form, allowedPaymentMethods: event.target.value })}>
          <option value="card">Solo tarjeta</option>
          <option value="bank_transfer">Solo SPEI</option>
          <option value="card_and_bank_transfer">Tarjeta y SPEI</option>
        </select>
        <input className="min-h-11 bg-pilula-black px-3" placeholder="Tipo de cambio MXN por USD" value={form.exchangeRate} onChange={(event) => setForm({ ...form, exchangeRate: event.target.value })} />
        <input className="min-h-11 bg-pilula-black px-3" placeholder="Nombre" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
        <input className="min-h-11 bg-pilula-black px-3" placeholder="Correo" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        <input className="min-h-11 bg-pilula-black px-3" placeholder="WhatsApp" value={form.whatsapp} onChange={(event) => setForm({ ...form, whatsapp: event.target.value })} />
        <input className="min-h-11 bg-pilula-black px-3" type="datetime-local" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.approved} onChange={(event) => setForm({ ...form, approved: event.target.checked })} /> Aprobar</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.sendEmail} onChange={(event) => setForm({ ...form, sendEmail: event.target.checked })} /> Enviar email con Resend</label>
        <button className="min-h-11 bg-pilula-burgundy px-5 text-sm font-semibold text-white">Crear invitación</button>
      </form>
      {createdUrl ? (
        <div className="border border-pilula-gold/25 p-4 text-sm">
          <p>Enlace generado:</p>
          <p className="break-all text-pilula-gold">{createdUrl}</p>
          <button className="mt-3 border border-pilula-gold/30 px-3 py-2" onClick={() => navigator.clipboard.writeText(createdUrl)}>Copiar enlace</button>
        </div>
      ) : null}
      <InvitesTable rows={rows} onRefresh={load} onCreatedUrl={setCreatedUrl} />
    </div>
  );
}

function InvitesTable({ rows, onRefresh, onCreatedUrl }: { rows: Row[]; onRefresh: () => Promise<void>; onCreatedUrl: (url: string) => void }) {
  const supabase = useSupabase();
  async function action(id: string, actionName: string) {
    const response = await fetch(`/api/admin/invites/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await authHeader(supabase)) },
      body: JSON.stringify({ action: actionName, sendEmail: actionName === "resend" })
    });
    if (response.ok) {
      const payload = (await response.json()) as { url?: string; whatsappUrl?: string };
      if (payload.url) onCreatedUrl(payload.url);
      if (payload.whatsappUrl) window.open(payload.whatsappUrl, "_blank", "noopener,noreferrer");
      await onRefresh();
    }
  }

  if (rows.length === 0) return <p className="text-sm text-pilula-ivory/65">Sin invitaciones o sesión no autorizada.</p>;
  return (
    <div className="overflow-x-auto border border-pilula-gold/20">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="bg-pilula-charcoal text-pilula-gold">
          <tr><th className="px-3 py-2">nombre</th><th className="px-3 py-2">email</th><th className="px-3 py-2">perfil</th><th className="px-3 py-2">status</th><th className="px-3 py-2">expira</th><th className="px-3 py-2">acciones</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-t border-pilula-gold/10" key={String(row.id)}>
              <td className="px-3 py-2">{String(row.full_name || "")}</td>
              <td className="px-3 py-2">{String(row.email || "")}</td>
              <td className="px-3 py-2">{String(row.profile_type || "")}</td>
              <td className="px-3 py-2">{String(row.status || "")}</td>
              <td className="px-3 py-2">{String(row.expires_at || "")}</td>
              <td className="flex flex-wrap gap-2 px-3 py-2">
                <button className="border border-pilula-gold/25 px-2 py-1" onClick={() => action(String(row.id), "approve")}>Aprobar</button>
                <button className="border border-pilula-gold/25 px-2 py-1" onClick={() => action(String(row.id), "resend")}>Reenviar</button>
                <button className="border border-pilula-gold/25 px-2 py-1" onClick={() => action(String(row.id), "revoke")}>Revocar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminData({ endpoint, csvPath, label }: { endpoint: string; csvPath: string; label: string }) {
  const supabase = useSupabase();
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    async function load() {
      const response = await fetch(endpoint, { headers: await authHeader(supabase) });
      if (response.ok) {
        const payload = (await response.json()) as Record<string, Row[]>;
        setRows(Object.values(payload)[0] || []);
      }
    }
    void load();
  }, [endpoint, supabase]);

  return (
    <div className="space-y-5">
      <FilterBar filter={filter} setFilter={setFilter} />
      <ExportButton endpoint={csvPath} filename={`${label}-pilula.csv`} label={label} />
      <DataTable rows={filterRows(rows, filter)} />
    </div>
  );
}

function FilterBar({ filter, setFilter }: { filter: string; setFilter: (value: string) => void }) {
  const filters = ["", "usd", "mxn", "card", "bank_transfer", "awaiting_bank_transfer", "partially_funded", "paid", "expired", "requires_manual_review"];
  return (
    <select className="min-h-11 border border-pilula-gold/25 bg-pilula-black px-3 text-sm" value={filter} onChange={(event) => setFilter(event.target.value)}>
      {filters.map((item) => <option key={item || "all"} value={item}>{item || "Todos"}</option>)}
    </select>
  );
}

function filterRows(rows: Row[], filter: string) {
  if (!filter) return rows;
  return rows.filter((row) => Object.values(row).some((value) => String(value).toLowerCase() === filter));
}

export function InvoicesAdmin() {
  const supabase = useSupabase();
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/invoices", { headers: await authHeader(supabase) });
    if (response.ok) setRows(((await response.json()) as { invoices: Row[] }).invoices || []);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(id: string, status: string) {
    await fetch("/api/admin/invoices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await authHeader(supabase)) },
      body: JSON.stringify({ id, status })
    });
    await load();
  }

  return (
    <div className="space-y-5">
      <ExportButton endpoint="/api/admin/invoices?format=csv" filename="facturas-pilula.csv" label="facturas" />
      <div className="overflow-x-auto border border-pilula-gold/20">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-pilula-charcoal text-pilula-gold">
            <tr><th className="px-3 py-2">id</th><th className="px-3 py-2">order_id</th><th className="px-3 py-2">rfc</th><th className="px-3 py-2">email</th><th className="px-3 py-2">status</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-t border-pilula-gold/10" key={String(row.id)}>
                <td className="px-3 py-2">{String(row.id)}</td>
                <td className="px-3 py-2">{String(row.order_id)}</td>
                <td className="px-3 py-2">{String(row.rfc)}</td>
                <td className="px-3 py-2">{String(row.invoice_email)}</td>
                <td className="px-3 py-2">
                  <select className="bg-pilula-black" value={String(row.status)} onChange={(event) => updateStatus(String(row.id), event.target.value)}>
                    <option value="solicitada">solicitada</option>
                    <option value="en_revision">en revisión</option>
                    <option value="requiere_correccion">requiere corrección</option>
                    <option value="emitida">emitida</option>
                    <option value="enviada">enviada</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PricingConfigAdmin() {
  const supabase = useSupabase();
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState({
    rate: "",
    effectiveFrom: new Date().toISOString().slice(0, 16),
    effectiveUntil: "",
    status: "active"
  });

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/pricing", { headers: await authHeader(supabase) });
    if (response.ok) setRows(((await response.json()) as { rates: Row[] }).rates || []);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await fetch("/api/admin/pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader(supabase)) },
      body: JSON.stringify({
        ...form,
        effectiveFrom: new Date(form.effectiveFrom).toISOString(),
        effectiveUntil: form.effectiveUntil ? new Date(form.effectiveUntil).toISOString() : null
      })
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="grid gap-4 border border-pilula-gold/25 p-5 md:grid-cols-2">
        <input className="min-h-11 bg-pilula-black px-3" placeholder="USD_MXN_RATE" value={form.rate} onChange={(event) => setForm({ ...form, rate: event.target.value })} />
        <input className="min-h-11 bg-pilula-black px-3" type="datetime-local" value={form.effectiveFrom} onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })} />
        <input className="min-h-11 bg-pilula-black px-3" type="datetime-local" value={form.effectiveUntil} onChange={(event) => setForm({ ...form, effectiveUntil: event.target.value })} />
        <select className="min-h-11 bg-pilula-black px-3" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </select>
        <button className="min-h-11 bg-pilula-burgundy px-5 text-sm font-semibold text-white">Guardar tipo de cambio</button>
      </form>
      <DataTable rows={rows} />
    </div>
  );
}

function ExportButton({ endpoint, filename, label }: { endpoint: string; filename: string; label: string }) {
  const supabase = useSupabase();
  async function download() {
    const response = await fetch(endpoint, { headers: await authHeader(supabase) });
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <button className="inline-flex min-h-11 items-center border border-pilula-gold/30 px-4 text-sm" onClick={download}>
      Exportar {label} a CSV
    </button>
  );
}

function DataTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return <p className="text-sm text-pilula-ivory/65">Sin registros o sesión no autorizada.</p>;
  const headers = Object.keys(rows[0]).slice(0, 10);
  return (
    <div className="overflow-x-auto border border-pilula-gold/20">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-pilula-charcoal text-pilula-gold">
          <tr>{headers.map((header) => <th className="px-3 py-2" key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr className="border-t border-pilula-gold/10" key={String(row.id || index)}>
              {headers.map((header) => <td className="px-3 py-2 text-pilula-ivory/72" key={header}>{String(row[header] ?? "")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
