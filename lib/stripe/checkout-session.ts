import Stripe from "stripe";
import { EVENT, type PaymentMethod, type PlanKey } from "@/config/checkout";
import { getEnv, getStripeEnvironment } from "@/lib/env";
import { getStripe } from "@/lib/stripe/client";
import type { OrderRecord } from "@/lib/orders";
import type { PaymentInvite } from "@/lib/payment-invites";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type CreateCheckoutSessionInput = {
  plan: PlanKey;
  order: OrderRecord;
  invite: PaymentInvite;
  paymentMethod: PaymentMethod;
};

async function ensureStripeCustomer(invite: PaymentInvite) {
  const stripe = getStripe();
  if (invite.stripe_customer_id) return invite.stripe_customer_id;
  const customer = await stripe.customers.create({
    email: invite.email,
    name: invite.full_name || undefined,
    phone: invite.whatsapp || undefined,
    metadata: {
      payment_invite_id: invite.id,
      source: "checkout_pilula",
      environment: getStripeEnvironment() || "test",
      livemode: String(getStripeEnvironment() === "live")
    }
  });
  const supabase = getSupabaseAdmin();
  await supabase?.from("payment_invites").update({ stripe_customer_id: customer.id }).eq("id", invite.id);
  invite.stripe_customer_id = customer.id;
  return customer.id;
}

export async function createCheckoutSession({ plan, order, invite, paymentMethod }: CreateCheckoutSessionInput) {
  const env = getEnv();
  const stripe = getStripe();
  const stripeEnvironment = getStripeEnvironment(env.STRIPE_SECRET_KEY) || "test";
  const siteUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const metadata = {
    event: EVENT.eventMetadata,
    edition: EVENT.editionMetadata,
    profile_type: plan,
    order_id: order.id,
    payment_invite_id: invite.id,
    source: "checkout_pilula",
    terms_version: invite.terms_version,
    terms_hash: invite.terms_hash,
    cancellation_policy_version: invite.cancellation_policy_version,
    payment_currency: invite.payment_currency,
    payment_method: paymentMethod,
    environment: stripeEnvironment,
    livemode: String(stripeEnvironment === "live")
  };
  const usePriceData = invite.payment_currency === "mxn" || !invite.stripe_price_id;

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: [
      usePriceData
        ? {
            price_data: {
              currency: invite.payment_currency,
              unit_amount: invite.amount_subtotal,
              product_data: {
                name: `HTW 2026 · ${plan === "doctor" ? "Médico participante" : "Paciente seleccionado"}`,
                metadata
              },
              tax_behavior: "exclusive"
            },
            quantity: 1,
            tax_rates: [env.STRIPE_TAX_RATE_IVA_16]
          }
        : {
            price: invite.stripe_price_id as string,
            quantity: 1,
            tax_rates: [env.STRIPE_TAX_RATE_IVA_16]
          }
    ],
    billing_address_collection: "required",
    phone_number_collection: { enabled: true },
    tax_id_collection: { enabled: true },
    locale: "auto",
    consent_collection: { terms_of_service: "required" },
    allow_promotion_codes: false,
    success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/cancelled?plan=${plan}`,
    client_reference_id: order.id,
    metadata,
    payment_intent_data: {
      statement_descriptor_suffix: "HTW2026",
      metadata
    }
  };

  if (paymentMethod === "card") {
    sessionParams.customer_creation = "always";
    sessionParams.payment_method_options = {
      card: {
        request_three_d_secure: "automatic"
      }
    };
  } else {
    sessionParams.payment_method_types = ["customer_balance"];
    sessionParams.customer = await ensureStripeCustomer(invite);
    sessionParams.payment_method_options = {
      customer_balance: {
        funding_type: "bank_transfer",
        bank_transfer: {
          type: "mx_bank_transfer",
          requested_address_types: ["spei"]
        }
      }
    };
    sessionParams.custom_text = {
      submit: {
        message:
          "Tu lugar quedará confirmado cuando Stripe notifique la recepción completa de los fondos. Usa exactamente la referencia proporcionada por Stripe."
      }
    };
  }

  if (plan === "doctor") {
    sessionParams.custom_fields = [
      {
        key: "specialty",
        label: { type: "custom", custom: "Especialidad médica" },
        type: "text",
        optional: false
      },
      {
        key: "city_country",
        label: { type: "custom", custom: "Ciudad / país" },
        type: "text",
        optional: false
      }
    ];
  }

  const session = await stripe.checkout.sessions.create(sessionParams, {
    idempotencyKey: `checkout:${order.id}`
  });
  if (paymentMethod === "bank_transfer") {
    return stripe.checkout.sessions.retrieve(session.id, { expand: ["payment_intent"] });
  }
  return session;
}

export async function createBalanceCheckoutSession(order: OrderRecord, publicToken: string) {
  const env = getEnv();
  const stripe = getStripe();
  const stripeEnvironment = getStripeEnvironment(env.STRIPE_SECRET_KEY) || "test";
  const siteUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const amountDue = order.amount_remaining || order.balance_amount || 0;
  const metadata = {
    event: EVENT.eventMetadata,
    edition: EVENT.editionMetadata,
    profile_type: order.profile_type,
    order_id: order.id,
    source: "checkout_pilula_balance",
    payment_type: "balance",
    payment_option: "balance",
    environment: stripeEnvironment,
    livemode: String(stripeEnvironment === "live")
  };

  return stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: order.currency,
            unit_amount: amountDue,
            product_data: {
              name: `HTW 2026 · Saldo ${order.profile_type === "doctor" ? "médico participante" : "paciente seleccionado"}`,
              metadata
            },
            tax_behavior: "inclusive"
          },
          quantity: 1
        }
      ],
      billing_address_collection: "required",
      phone_number_collection: { enabled: true },
      tax_id_collection: { enabled: true },
      locale: "auto",
      consent_collection: { terms_of_service: "required" },
      allow_promotion_codes: false,
      success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/pagar-saldo/${publicToken}`,
      customer_email: order.email || undefined,
      client_reference_id: order.id,
      metadata,
      payment_intent_data: {
        statement_descriptor_suffix: "HTW2026",
        metadata
      },
      customer_creation: "always",
      payment_method_options: {
        card: {
          request_three_d_secure: "automatic"
        }
      }
    },
    {
      idempotencyKey: `balance:${order.id}:${amountDue}`
    }
  );
}
