"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
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
  allowedPaymentMethods: AllowedPaymentMethods;
  recommendedPaymentMethod: PaymentMethod;
};

export function CheckoutPanel({
  inviteToken,
  profileType,
  currency,
  amountSubtotal,
  amountTax,
  amountTotal,
  allowedPaymentMethods,
  recommendedPaymentMethod
}: Props) {
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null);
  const [error, setError] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [totalAccepted, setTotalAccepted] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(recommendedPaymentMethod);

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
  const disabled = loadingPlan !== null || !termsAccepted || !totalAccepted;
  const canCard = allowedPaymentMethods === "card" || allowedPaymentMethods === "card_and_bank_transfer";
  const canSpei = allowedPaymentMethods === "bank_transfer" || allowedPaymentMethods === "card_and_bank_transfer";

  return (
    <section className="space-y-4" aria-label="Pago privado">
      <article className="border border-pilula-gold/40 bg-pilula-charcoal p-5 shadow-gold">
        <div className="space-y-4">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-pilula-gold">{selected.displayTitle}</p>
            <p className="mt-4 text-3xl font-semibold">{formatMoney(amountSubtotal, currency)}</p>
            <p className="text-sm text-pilula-ivory/65">+ IVA {formatMoney(amountTax, currency)}</p>
          </div>
          <div className="border-t border-pilula-gold/15 pt-4">
            <p className="text-sm text-pilula-ivory/65">Total</p>
            <p className="text-2xl font-semibold">{formatMoney(amountTotal, currency)}</p>
          </div>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-pilula-ivory">Método de pago</legend>
            {canCard ? (
              <label className="flex min-h-11 items-center gap-3 border border-pilula-gold/20 px-3 text-sm text-pilula-ivory/78">
                <input className="accent-pilula-burgundy" type="radio" checked={paymentMethod === "card"} onChange={() => setPaymentMethod("card")} />
                <span>Tarjeta {currency === "mxn" ? "mexicana en MXN" : "internacional en USD"}</span>
              </label>
            ) : null}
            {canSpei ? (
              <label className="flex min-h-11 items-center gap-3 border border-pilula-gold/20 px-3 text-sm text-pilula-ivory/78">
                <input className="accent-pilula-burgundy" type="radio" checked={paymentMethod === "bank_transfer"} onChange={() => setPaymentMethod("bank_transfer")} />
                <span>SPEI en MXN {recommendedPaymentMethod === "bank_transfer" ? "· recomendado" : ""}</span>
              </label>
            ) : null}
          </fieldset>
          <label className="flex gap-3 text-sm leading-6 text-pilula-ivory/78">
            <input className="mt-1 h-4 w-4 accent-pilula-burgundy" type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />
            <span>Acepto los términos de inscripción y la política de cancelación.</span>
          </label>
          <label className="flex gap-3 text-sm leading-6 text-pilula-ivory/78">
            <input className="mt-1 h-4 w-4 accent-pilula-burgundy" type="checkbox" checked={totalAccepted} onChange={(event) => setTotalAccepted(event.target.checked)} />
            <span>Confirmo expresamente el total de {formatMoney(amountTotal, currency)} en {currency.toUpperCase()}.</span>
          </label>
          <button
            type="button"
            disabled={disabled}
            onClick={startCheckout}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 bg-pilula-burgundy px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#7A0A40] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingPlan ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            {loadingPlan ? "Preparando pago seguro..." : `Continuar con pago de ${selected.displayTitle.toLowerCase()}`}
          </button>
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
