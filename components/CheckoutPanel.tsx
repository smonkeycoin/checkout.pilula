"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Loader2, MailCheck } from "lucide-react";
import {
  formatMoney,
  PLANS,
  type AllowedPaymentMethods,
  type PaymentCurrency,
  type PaymentMethod,
  type PlanKey
} from "@/config/checkout";

type Props = {
  inviteToken: string;
  profileType: PlanKey;
  currency: PaymentCurrency;
  amountSubtotal: number;
  amountTax: number;
  amountTotal: number;
  amountOriginalTotal?: number | null;
  discountPercent?: number | string | null;
  discountAmountTotal?: number | null;
  allowedPaymentMethods: AllowedPaymentMethods;
  recommendedPaymentMethod: PaymentMethod;
  maskedEmail: string;
  initialEmailVerified: boolean;
  stripeConfigured: boolean;
};

export function CheckoutPanel({
  inviteToken,
  profileType,
  currency,
  amountSubtotal,
  amountTax,
  amountTotal,
  amountOriginalTotal,
  discountPercent,
  discountAmountTotal,
  allowedPaymentMethods,
  recommendedPaymentMethod,
  maskedEmail,
  initialEmailVerified,
  stripeConfigured
}: Props) {
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null);
  const [error, setError] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [totalAccepted, setTotalAccepted] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(recommendedPaymentMethod);
  const [otpSent, setOtpSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(initialEmailVerified);
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!resendAvailableAt || emailVerified) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [emailVerified, resendAvailableAt]);

  async function sendOtp() {
    setOtpLoading(true);
    setError("");
    try {
      const response = await fetch("/api/payment-invite-otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteToken })
      });
      const payload = (await response.json()) as { error?: string; resendAvailableAt?: string; retryAfterSeconds?: number };
      if (!response.ok) throw new Error(payload.error || "No pudimos enviar el código.");
      setOtpSent(true);
      setResendAvailableAt(payload.resendAvailableAt ? new Date(payload.resendAvailableAt).getTime() : Date.now() + 60_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos enviar el código.");
    } finally {
      setOtpLoading(false);
    }
  }

  async function verifyOtp() {
    setOtpLoading(true);
    setError("");
    try {
      const response = await fetch("/api/payment-invite-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteToken, code: otpCode })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Código inválido o vencido.");
      setEmailVerified(true);
      setOtpCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido o vencido.");
    } finally {
      setOtpLoading(false);
    }
  }

  async function startCheckout() {
    setLoadingPlan(profileType);
    setError("");

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteToken,
          termsAccepted,
          totalAccepted,
          paymentMethod,
          website: ""
        })
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || "No pudimos preparar el pago.");
      }
      window.location.assign(payload.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos preparar el pago.");
      setLoadingPlan(null);
    }
  }

  const selected = PLANS[profileType];
  const disabled = loadingPlan !== null || !emailVerified || !termsAccepted || !totalAccepted;
  const canCard = allowedPaymentMethods === "card" || allowedPaymentMethods === "card_and_bank_transfer";
  const canSpei = allowedPaymentMethods === "bank_transfer" || allowedPaymentMethods === "card_and_bank_transfer";
  const resendSeconds = resendAvailableAt ? Math.max(0, Math.ceil((resendAvailableAt - now) / 1000)) : 0;
  const paymentDisabled = !emailVerified || loadingPlan !== null;
  const normalizedDiscount = Number(discountPercent || 0);
  const hasDiscount = normalizedDiscount > 0;

  return (
    <section className="space-y-4" aria-label="Pago privado">
      <article className="border border-pilula-gold/40 bg-pilula-charcoal p-5 shadow-gold">
        <div className="space-y-4">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-pilula-gold">{selected.displayTitle}</p>
            {hasDiscount && amountOriginalTotal ? (
              <p className="mt-4 text-sm text-pilula-ivory/60 line-through">{formatMoney(amountOriginalTotal, currency)}</p>
            ) : null}
            <p className="mt-4 text-3xl font-semibold">{formatMoney(amountSubtotal, currency)}</p>
            <p className="text-sm text-pilula-ivory/65">+ IVA {formatMoney(amountTax, currency)}</p>
          </div>
          {hasDiscount ? (
            <div className="border border-pilula-gold/25 p-3 text-sm text-pilula-ivory/72">
              <p>Descuento invitación: -{normalizedDiscount}%</p>
              <p>Ahorro: {formatMoney(discountAmountTotal || 0, currency)}</p>
            </div>
          ) : null}
          <div className="border-t border-pilula-gold/15 pt-4">
            <p className="text-sm text-pilula-ivory/65">Total</p>
            <p className="text-2xl font-semibold">{formatMoney(amountTotal, currency)}</p>
          </div>
          <div className="border border-pilula-gold/25 p-4">
            {emailVerified ? (
              <p className="inline-flex items-center gap-2 border border-pilula-gold/40 px-3 py-1 text-xs uppercase tracking-[0.16em] text-pilula-gold">
                <MailCheck className="h-4 w-4" aria-hidden="true" />
                Correo verificado
              </p>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold">Verifica tu correo para continuar</p>
                  <p className="mt-1 text-sm text-pilula-ivory/65">Enviaremos un código de 6 dígitos a {maskedEmail}.</p>
                </div>
                {!otpSent ? (
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center justify-center bg-pilula-burgundy px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={otpLoading}
                    onClick={sendOtp}
                  >
                    {otpLoading ? "Enviando..." : "Enviar código"}
                  </button>
                ) : (
                  <div className="grid gap-3">
                    <input
                      className="min-h-11 border border-pilula-gold/25 bg-pilula-black px-3 text-center text-xl tracking-[0.18em]"
                      inputMode="numeric"
                      maxLength={6}
                      pattern="[0-9]*"
                      placeholder="000000"
                      value={otpCode}
                      onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    />
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        className="inline-flex min-h-11 items-center justify-center bg-pilula-burgundy px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={otpLoading || otpCode.length !== 6}
                        onClick={verifyOtp}
                      >
                        {otpLoading ? "Verificando..." : "Verificar código"}
                      </button>
                      <button
                        type="button"
                        className="inline-flex min-h-11 items-center justify-center border border-pilula-gold/30 px-4 text-sm text-pilula-ivory disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={otpLoading || resendSeconds > 0}
                        onClick={sendOtp}
                      >
                        {resendSeconds > 0 ? `Reenviar en ${resendSeconds}s` : "Reenviar código"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-pilula-ivory">Método de pago</legend>
            {canCard ? (
              <label className="flex min-h-11 items-center gap-3 border border-pilula-gold/20 px-3 text-sm text-pilula-ivory/78">
                <input className="accent-pilula-burgundy disabled:cursor-not-allowed" type="radio" disabled={paymentDisabled} checked={paymentMethod === "card"} onChange={() => setPaymentMethod("card")} />
                <span>Tarjeta {currency === "mxn" ? "mexicana en MXN" : "internacional en USD"}</span>
              </label>
            ) : null}
            {canSpei ? (
              <label className="flex min-h-11 items-center gap-3 border border-pilula-gold/20 px-3 text-sm text-pilula-ivory/78">
                <input className="accent-pilula-burgundy disabled:cursor-not-allowed" type="radio" disabled={paymentDisabled} checked={paymentMethod === "bank_transfer"} onChange={() => setPaymentMethod("bank_transfer")} />
                <span>SPEI en MXN {recommendedPaymentMethod === "bank_transfer" ? "· recomendado" : ""}</span>
              </label>
            ) : null}
            {canSpei ? (
              <p className="text-sm leading-6 text-pilula-ivory/65">
                Stripe generará una referencia bancaria única. Tu lugar quedará confirmado cuando se acredite el pago completo.
              </p>
            ) : null}
          </fieldset>
          <label className="flex gap-3 text-sm leading-6 text-pilula-ivory/78">
            <input className="mt-1 h-4 w-4 accent-pilula-burgundy disabled:cursor-not-allowed" type="checkbox" disabled={!emailVerified} checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />
            <span>Acepto los términos de inscripción y la política de cancelación.</span>
          </label>
          <label className="flex gap-3 text-sm leading-6 text-pilula-ivory/78">
            <input className="mt-1 h-4 w-4 accent-pilula-burgundy disabled:cursor-not-allowed" type="checkbox" disabled={!emailVerified} checked={totalAccepted} onChange={(event) => setTotalAccepted(event.target.checked)} />
            <span>Confirmo expresamente el total de {formatMoney(amountTotal, currency)} en {currency.toUpperCase()}.</span>
          </label>
          <button
            type="button"
            disabled={disabled}
            onClick={startCheckout}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 bg-pilula-burgundy px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#7A0A40] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingPlan ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            {loadingPlan ? "Preparando pago seguro..." : stripeConfigured ? `Continuar con pago de ${selected.displayTitle.toLowerCase()}` : "Continuar al pago de prueba"}
          </button>
          <p className="text-center text-xs leading-5 text-pilula-ivory/60">
            Tu participación no se confirma hasta que Stripe reciba el pago completo.
          </p>
        </div>
      </article>
      {error ? (
        <p className="border border-pilula-burgundy/50 bg-pilula-burgundy/15 px-4 py-3 text-sm text-pilula-ivory" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
