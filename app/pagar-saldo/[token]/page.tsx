import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { formatMoney } from "@/config/checkout";
import { getOrderByPublicToken } from "@/lib/orders";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function BalancePaymentPage({ params }: Props) {
  const { token } = await params;
  const order = await getOrderByPublicToken(token);
  if (!order) notFound();

  const amountDue = order.amount_remaining || order.balance_amount || 0;
  const canPay =
    order.payment_option === "deposit" &&
    order.deposit_status === "paid" &&
    order.balance_status === "pending" &&
    amountDue > 0;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-5 py-14 lg:px-8">
        <section className="border border-pilula-gold/30 bg-pilula-charcoal p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.22em] text-pilula-gold">Saldo pendiente</p>
          <h1 className="mt-4 text-3xl font-semibold">Completa tu pago</h1>
          <div className="mt-6 space-y-3 text-pilula-ivory/76">
            <p>
              Orden: <strong className="text-pilula-ivory">{order.reference}</strong>
            </p>
            <p>Anticipo recibido: {formatMoney(order.amount_received || order.deposit_amount || 0, order.currency)}</p>
            <p>Saldo por cobrar: {formatMoney(amountDue, order.currency)}</p>
          </div>
          {canPay ? (
            <form className="mt-8" action="/api/balance-checkout" method="post">
              <input type="hidden" name="token" value={token} />
              <button className="inline-flex min-h-12 items-center justify-center bg-pilula-burgundy px-6 text-sm font-semibold text-white" type="submit">
                Pagar saldo
              </button>
            </form>
          ) : (
            <p className="mt-8 border border-pilula-gold/25 p-4 text-sm text-pilula-ivory/72">
              Esta orden no tiene saldo pendiente disponible para pago.
            </p>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
