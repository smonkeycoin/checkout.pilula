import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { EVENT, formatMoney } from "@/config/checkout";
import { isPlaceholder, getEnv } from "@/lib/env";
import { buildInvoiceLink, displayPlanName, getOrderBySession } from "@/lib/orders";
import { getStripe } from "@/lib/stripe/client";

type Props = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function SuccessPage({ searchParams }: Props) {
  const { session_id: sessionId } = await searchParams;
  const env = getEnv();
  let state:
    | { ok: true; reference: string; profile: string; amount: number; currency: "usd" | "mxn"; email: string; invoiceUrl: string }
    | { ok: "pending"; reference: string; amount: number; received: number; remaining: number; currency: "usd" | "mxn" }
    | { ok: false; message: string } = { ok: false, message: "No encontramos una sesión de pago para validar." };

  if (sessionId && !isPlaceholder(env.STRIPE_SECRET_KEY)) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      const order = await getOrderBySession(sessionId);
      if (session.payment_status === "paid" && order) {
        state = {
          ok: true,
          reference: order.reference,
          profile: displayPlanName(order.profile_type),
          amount: session.amount_total || order.amount_total,
          currency: order.currency,
          email: session.customer_details?.email || order.email || "",
          invoiceUrl: buildInvoiceLink(order)
        };
      } else if (order && session.payment_status === "unpaid") {
        state = {
          ok: "pending",
          reference: order.reference,
          amount: order.amount_total,
          received: order.amount_received || 0,
          remaining: order.amount_remaining ?? order.amount_total,
          currency: order.currency
        };
      } else {
        state = { ok: false, message: "Stripe no reporta este pago como completado todavía." };
      }
    } catch {
      state = { ok: false, message: "No pudimos validar la sesión directamente con Stripe." };
    }
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-5 py-14 lg:px-8">
        <div className="border border-pilula-gold/30 bg-pilula-charcoal p-6 sm:p-8">
          <CheckCircle2 className="h-12 w-12 text-pilula-gold" aria-hidden="true" />
          <h1 className="mt-5 text-3xl font-semibold">{state.ok === true ? "Pago confirmado." : "Validación pendiente."}</h1>
          {state.ok === true ? (
            <div className="mt-6 space-y-3 text-pilula-ivory/76">
              <p>Referencia de orden: <strong className="text-pilula-ivory">{state.reference}</strong></p>
              <p>Modalidad: {state.profile}</p>
              <p>Monto pagado: {formatMoney(state.amount, state.currency)}</p>
              <p>Enviaremos la confirmación a: {state.email}</p>
              <div className="flex flex-col gap-3 pt-4 sm:flex-row">
                <Link className="inline-flex min-h-11 items-center justify-center bg-pilula-burgundy px-5 text-sm font-semibold text-white" href={state.invoiceUrl}>
                  Solicitar factura
                </Link>
                <a className="inline-flex min-h-11 items-center justify-center border border-pilula-gold/40 px-5 text-sm font-semibold" href={EVENT.mainSiteUrl}>
                  Volver a PILULA
                </a>
              </div>
            </div>
          ) : state.ok === "pending" ? (
            <div className="mt-6 space-y-3 text-pilula-ivory/76">
              <p>Referencia de orden: <strong className="text-pilula-ivory">{state.reference}</strong></p>
              <p>Total: {formatMoney(state.amount, state.currency)}</p>
              <p>Importe recibido: {formatMoney(state.received, state.currency)}</p>
              <p>Saldo pendiente: {formatMoney(state.remaining, state.currency)}</p>
              <p>Tu lugar quedará confirmado cuando Stripe notifique la recepción completa de los fondos.</p>
              <p>Una transferencia sin referencia correcta puede tardar en conciliarse.</p>
            </div>
          ) : (
            <p className="mt-4 leading-7 text-pilula-ivory/72">{state.message}</p>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
