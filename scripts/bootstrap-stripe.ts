import fs from "node:fs";
import path from "node:path";
import Stripe from "stripe";

type EnvPatch = Record<string, string>;

const WEBHOOK_URL = "https://pagos.pilula.com.mx/api/stripe/webhook";
const WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "customer_cash_balance_transaction.created"
] as const;

const PRODUCTS = {
  doctor: {
    envName: "STRIPE_PRICE_DOCTOR",
    name: "Hair Transplant Workshop 2026 · Médico participante",
    description: "Inscripción como médico participante al programa PÍLULA MedPlanner 2026.",
    metadata: {
      pilula_resource: "doctor",
      event_year: "2026",
      environment: "test"
    },
    unitAmount: 600000
  },
  patient: {
    envName: "STRIPE_PRICE_PATIENT",
    name: "Hair Transplant Workshop 2026 · Paciente participante",
    description: "Participación como paciente seleccionado en PÍLULA MedPlanner 2026.",
    metadata: {
      pilula_resource: "patient",
      event_year: "2026",
      environment: "test"
    },
    unitAmount: 80000
  }
} as const;

function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    const filePath = path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) continue;
    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/u);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/gu, "");
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  }
}

function redactSecret(value: string) {
  if (!value) return "";
  if (value.length <= 12) return `${value.slice(0, 4)}...`;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function assertTestKey(secretKey: string) {
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY no está configurado.");
  if (secretKey.startsWith("sk_live_")) {
    throw new Error("STRIPE_SECRET_KEY es live. Abortando: este bootstrap solo puede operar en Test Mode.");
  }
  if (!secretKey.startsWith("sk_test_") && !secretKey.startsWith("rk_test_")) {
    throw new Error("STRIPE_SECRET_KEY debe ser una llave test de Stripe.");
  }
}

async function autoPage<T>(listPromise: Stripe.ApiListPromise<T>) {
  return listPromise.autoPagingToArray({ limit: 1000 });
}

function assertLivemodeFalse(resources: Array<{ id?: string; livemode?: boolean }>, label: string) {
  const live = resources.filter((resource) => resource.livemode !== false);
  if (live.length > 0) {
    throw new Error(`${label} contiene recursos que no son livemode:false. Abortando.`);
  }
}

function sameEvents(current: string[]) {
  return WEBHOOK_EVENTS.length === current.length && WEBHOOK_EVENTS.every((event) => current.includes(event));
}

async function ensureProductAndPrice(stripe: Stripe, key: keyof typeof PRODUCTS) {
  const config = PRODUCTS[key];
  const products = await autoPage(stripe.products.list({ limit: 100 }));
  assertLivemodeFalse(products, "products");
  let product = products.find(
    (item) =>
      item.metadata?.pilula_resource === config.metadata.pilula_resource &&
      item.metadata?.environment === "test" &&
      item.metadata?.event_year === "2026"
  );

  if (!product) {
    product = await stripe.products.create({
      name: config.name,
      description: config.description,
      metadata: config.metadata
    });
  }

  if (product.livemode !== false) throw new Error(`Producto ${product.id} no está en Test Mode.`);

  const prices = await autoPage(stripe.prices.list({ product: product.id, limit: 100 }));
  assertLivemodeFalse(prices, "prices");
  let price = prices.find(
    (item) =>
      item.active &&
      item.type === "one_time" &&
      item.currency === "usd" &&
      item.unit_amount === config.unitAmount &&
      item.tax_behavior === "exclusive"
  );

  if (!price) {
    price = await stripe.prices.create({
      product: product.id,
      unit_amount: config.unitAmount,
      currency: "usd",
      tax_behavior: "exclusive",
      metadata: config.metadata
    });
  }

  if (price.livemode !== false) throw new Error(`Price ${price.id} no está en Test Mode.`);

  return { product, price };
}

async function ensureTaxRate(stripe: Stripe) {
  const taxRates = await autoPage(stripe.taxRates.list({ limit: 100 }));
  assertLivemodeFalse(taxRates, "tax rates");
  let taxRate = taxRates.find(
    (item) =>
      item.active &&
      item.display_name === "IVA" &&
      item.description === "IVA México 16%" &&
      item.percentage === 16 &&
      item.inclusive === false &&
      item.country === "MX" &&
      item.jurisdiction === "México" &&
      item.tax_type === "vat"
  );

  if (!taxRate) {
    taxRate = await stripe.taxRates.create({
      display_name: "IVA",
      description: "IVA México 16%",
      percentage: 16,
      inclusive: false,
      country: "MX",
      jurisdiction: "México",
      tax_type: "vat",
      metadata: {
        pilula_resource: "iva_16",
        event_year: "2026",
        environment: "test"
      }
    });
  }

  if (taxRate.livemode !== false) throw new Error(`Tax Rate ${taxRate.id} no está en Test Mode.`);
  return taxRate;
}

async function ensureWebhook(stripe: Stripe) {
  const endpoints = await autoPage(stripe.webhookEndpoints.list({ limit: 100 }));
  assertLivemodeFalse(endpoints, "webhook endpoints");
  let endpoint = endpoints.find((item) => item.url === WEBHOOK_URL && sameEvents(item.enabled_events));
  let secret: string | undefined;

  if (!endpoint) {
    const sameUrl = endpoints.find((item) => item.url === WEBHOOK_URL);
    if (sameUrl) {
      endpoint = await stripe.webhookEndpoints.update(sameUrl.id, {
        enabled_events: [...WEBHOOK_EVENTS],
        metadata: {
          pilula_resource: "checkout_webhook",
          event_year: "2026",
          environment: "test"
        }
      });
    } else {
      endpoint = await stripe.webhookEndpoints.create({
        url: WEBHOOK_URL,
        enabled_events: [...WEBHOOK_EVENTS],
        metadata: {
          pilula_resource: "checkout_webhook",
          event_year: "2026",
          environment: "test"
        }
      });
      secret = endpoint.secret;
    }
  }

  if (endpoint.livemode !== false) throw new Error(`Webhook ${endpoint.id} no está en Test Mode.`);
  return { endpoint, secret };
}

function updateEnvLocal(values: EnvPatch) {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    return { updated: false, reason: ".env.local no existe" };
  }

  const existing = fs.readFileSync(envPath, "utf8");
  const lines = existing.split(/\r?\n/u);
  const seen = new Set<string>();
  const next = lines.map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=/u);
    if (!match || !(match[1] in values)) return line;
    seen.add(match[1]);
    return `${match[1]}=${values[match[1]]}`;
  });

  for (const [key, value] of Object.entries(values)) {
    if (!seen.has(key)) next.push(`${key}=${value}`);
  }

  fs.writeFileSync(envPath, next.join("\n").replace(/\n*$/u, "\n"));
  return { updated: true };
}

function printVercelBlock(values: EnvPatch) {
  console.log("\nVariables para Vercel (valores sensibles redactados):");
  for (const [key, value] of Object.entries(values)) {
    const printable = key === "STRIPE_WEBHOOK_SECRET" ? redactSecret(value) : value;
    console.log(`${key}=${printable}`);
  }
}

loadLocalEnv();
const secretKey = process.env.STRIPE_SECRET_KEY || "";
assertTestKey(secretKey);

const stripe = new Stripe(secretKey, {
  apiVersion: "2025-02-24.acacia",
  typescript: true
});

const account = await stripe.accounts.retrieve();
const probe = await stripe.products.list({ limit: 1 });
assertLivemodeFalse(probe.data, "stripe account probe products");

const doctor = await ensureProductAndPrice(stripe, "doctor");
const patient = await ensureProductAndPrice(stripe, "patient");
const taxRate = await ensureTaxRate(stripe);
const webhook = await ensureWebhook(stripe);

const envValues: EnvPatch = {
  STRIPE_PRICE_DOCTOR: doctor.price.id,
  STRIPE_PRICE_PATIENT: patient.price.id,
  STRIPE_TAX_RATE_IVA_16: taxRate.id
};

const existingWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
if (webhook.secret) {
  envValues.STRIPE_WEBHOOK_SECRET = webhook.secret;
} else if (existingWebhookSecret && !existingWebhookSecret.includes("placeholder")) {
  envValues.STRIPE_WEBHOOK_SECRET = existingWebhookSecret;
}

const envUpdate = updateEnvLocal(envValues);

console.log("Stripe Test bootstrap completado.");
console.log("Cuenta Stripe confirmada:", account.id);
console.log("Test Mode confirmado: todos los recursos verificados tienen livemode:false.");
console.log("Producto médico:", doctor.product.id);
console.log("Price médico:", doctor.price.id);
console.log("Producto paciente:", patient.product.id);
console.log("Price paciente:", patient.price.id);
console.log("Tax Rate IVA:", taxRate.id);
console.log("Webhook Endpoint:", webhook.endpoint.id);
console.log(
  "Webhook signing secret:",
  webhook.secret ? `capturado y guardable (${redactSecret(webhook.secret)})` : "endpoint reutilizado; Stripe no vuelve a mostrar el secret"
);
console.log(".env.local:", envUpdate.updated ? "actualizado localmente" : `no actualizado (${envUpdate.reason})`);
printVercelBlock(envValues);
