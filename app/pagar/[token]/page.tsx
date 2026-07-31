import { notFound } from "next/navigation";
import { CheckoutPanel } from "@/components/CheckoutPanel";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { TestModeNotice } from "@/components/TestModeNotice";
import { TrustList } from "@/components/TrustList";
import { EVENT, formatMoney, formatUsd, PLANS } from "@/config/checkout";
import { getPaymentInviteByToken } from "@/lib/payment-invites";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function PaymentInvitePage({ params }: Props) {
  const { token } = await params;
  const invite = await getPaymentInviteByToken(token, true);
  if (!invite.ok) notFound();

  const plan = PLANS[invite.invite.profile_type];

  return (
    <>
      <TestModeNotice />
      <Header />
      <main className="mx-auto grid max-w-5xl gap-10 px-5 py-12 md:grid-cols-[1fr_0.9fr] lg:px-8">
        <section className="space-y-6">
          <p className="text-sm font-semibold tracking-[0.24em] text-pilula-gold">
            INVITACIÓN PRIVADA · {EVENT.dateShort}
          </p>
          <h1 className="text-4xl font-semibold leading-tight">Pago privado para {plan.displayTitle.toLowerCase()}.</h1>
          <p className="text-lg leading-8 text-pilula-ivory/76">
            Esta invitación fue aprobada por el equipo organizador para {invite.invite.full_name || invite.invite.email}.
          </p>
          <div className="border border-pilula-gold/25 p-5">
            <p className="text-sm text-pilula-ivory/65">Total a pagar</p>
            <p className="mt-2 text-3xl font-semibold">{formatMoney(invite.invite.amount_total, invite.invite.payment_currency)}</p>
            <p className="mt-2 text-sm text-pilula-ivory/65">
              Subtotal {formatMoney(invite.invite.amount_subtotal, invite.invite.payment_currency)} + IVA{" "}
              {formatMoney(invite.invite.amount_tax, invite.invite.payment_currency)}
            </p>
            {invite.invite.payment_currency === "mxn" ? (
              <div className="mt-3 space-y-1 text-sm text-pilula-ivory/65">
                <p>Precio comercial de referencia: {formatUsd(invite.invite.base_amount_total_usd)}.</p>
                <p>Tipo de cambio PÍLULA aplicado: {invite.invite.exchange_rate_mxn_per_usd} MXN por USD.</p>
                <p>Importe respetado hasta: {new Date(invite.invite.expires_at).toLocaleDateString("es-MX")}.</p>
                <p>El importe en pesos fue fijado al emitir esta invitación y no cambiará durante su vigencia.</p>
              </div>
            ) : null}
            <p className="mt-3 text-sm text-pilula-ivory/65">
              Moneda: {invite.invite.payment_currency.toUpperCase()}. PÍLULA absorbe la comisión de Stripe.
            </p>
          </div>
          {invite.invite.profile_type === "patient" ? (
            <p className="border border-pilula-gold/25 p-4 text-sm leading-6 text-pilula-ivory/76">
              {PLANS.patient.requiredCopy}
            </p>
          ) : null}
          <TrustList />
        </section>
        <aside className="self-start">
          <CheckoutPanel
            inviteToken={token}
            profileType={invite.invite.profile_type}
            currency={invite.invite.payment_currency}
            amountSubtotal={invite.invite.amount_subtotal}
            amountTax={invite.invite.amount_tax}
            amountTotal={invite.invite.amount_total}
            allowedPaymentMethods={invite.invite.allowed_payment_methods}
            recommendedPaymentMethod={invite.invite.recommended_payment_method}
          />
        </aside>
      </main>
      <Footer />
    </>
  );
}
