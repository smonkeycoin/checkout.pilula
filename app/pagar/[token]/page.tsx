import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { CheckoutPanel } from "@/components/CheckoutPanel";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { TestModeNotice } from "@/components/TestModeNotice";
import { TrustList } from "@/components/TrustList";
import { EVENT, formatMoney, formatUsd, PLANS } from "@/config/checkout";
import { getEnv, isPlaceholder } from "@/lib/env";
import { displayName, isInviteOtpVerifiedFromCookies, maskEmail } from "@/lib/payment-invite-otp";
import { getPaymentInviteByToken } from "@/lib/payment-invites";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function PaymentInvitePage({ params }: Props) {
  const { token } = await params;
  const invite = await getPaymentInviteByToken(token, true);
  if (!invite.ok) notFound();

  const plan = PLANS[invite.invite.profile_type];
  const cookieStore = await cookies();
  const emailVerified = isInviteOtpVerifiedFromCookies(cookieStore, invite.invite.id);
  const env = getEnv();
  const stripeConfigured = !(
    isPlaceholder(env.STRIPE_SECRET_KEY) ||
    isPlaceholder(env.STRIPE_TAX_RATE_IVA_16) ||
    (invite.invite.payment_currency === "usd" && isPlaceholder(invite.invite.stripe_price_id || ""))
  );
  const visibleName = displayName(invite.invite.full_name, invite.invite.email);
  const expiresAt = new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City"
  }).format(new Date(invite.invite.expires_at));

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
            Esta invitación fue aprobada por el equipo organizador para {visibleName}.
          </p>
          <div className="border border-pilula-gold/25 p-5">
            {!stripeConfigured ? (
              <p className="mb-4 inline-flex border border-pilula-gold/40 px-3 py-1 text-xs uppercase tracking-[0.16em] text-pilula-gold">
                Modo de prueba
              </p>
            ) : null}
            <p className="text-sm text-pilula-ivory/65">Modalidad</p>
            <p className="mt-1 text-xl font-semibold">{plan.displayTitle}</p>
            <p className="mt-5 text-sm text-pilula-ivory/65">Total a pagar</p>
            <p className="mt-2 text-3xl font-semibold">{formatMoney(invite.invite.amount_total, invite.invite.payment_currency)}</p>
            <p className="mt-2 text-sm text-pilula-ivory/65">
              Subtotal {formatMoney(invite.invite.amount_subtotal, invite.invite.payment_currency)} + IVA{" "}
              {formatMoney(invite.invite.amount_tax, invite.invite.payment_currency)}
            </p>
            <dl className="mt-5 grid gap-3 border-t border-pilula-gold/15 pt-4 text-sm text-pilula-ivory/70 sm:grid-cols-2">
              <div>
                <dt className="text-pilula-ivory/50">Subtotal</dt>
                <dd>{formatMoney(invite.invite.amount_subtotal, invite.invite.payment_currency)}</dd>
              </div>
              <div>
                <dt className="text-pilula-ivory/50">IVA</dt>
                <dd>{formatMoney(invite.invite.amount_tax, invite.invite.payment_currency)}</dd>
              </div>
              <div>
                <dt className="text-pilula-ivory/50">Moneda</dt>
                <dd>{invite.invite.payment_currency.toUpperCase()}</dd>
              </div>
              <div>
                <dt className="text-pilula-ivory/50">Expira</dt>
                <dd>{expiresAt}</dd>
              </div>
              <div>
                <dt className="text-pilula-ivory/50">Correo</dt>
                <dd>{maskEmail(invite.invite.email)}</dd>
              </div>
              <div>
                <dt className="text-pilula-ivory/50">Tipo de cambio</dt>
                <dd>{invite.invite.exchange_rate_mxn_per_usd ? `${invite.invite.exchange_rate_mxn_per_usd} MXN/USD` : "No aplica"}</dd>
              </div>
            </dl>
            {invite.invite.payment_currency === "mxn" ? (
              <div className="mt-3 space-y-1 text-sm text-pilula-ivory/65">
                <p>Precio total de referencia: {formatUsd(invite.invite.base_amount_total_usd)}, IVA incluido.</p>
                <p>Tipo de cambio PÍLULA aplicado: {invite.invite.exchange_rate_mxn_per_usd} MXN por USD.</p>
                <p>Importe respetado hasta: {expiresAt}.</p>
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
            maskedEmail={maskEmail(invite.invite.email)}
            initialEmailVerified={emailVerified}
            stripeConfigured={stripeConfigured}
          />
        </aside>
      </main>
      <Footer />
    </>
  );
}
