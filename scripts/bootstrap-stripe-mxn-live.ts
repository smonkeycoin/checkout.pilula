import { execFileSync } from "node:child_process";

type StripeList<T> = { data: T[] };
type StripeProduct = {
  id: string;
  livemode: boolean;
  metadata?: Record<string, string>;
  name?: string;
};
type StripePrice = {
  id: string;
  active: boolean;
  livemode: boolean;
  currency: string;
  unit_amount: number | null;
  tax_behavior: string | null;
  metadata?: Record<string, string>;
};

const FIXED_FX_RATE = "17.50";
const PRICE_CONFIGS = [
  {
    envName: "STRIPE_PRICE_DOCTOR_MXN_FULL",
    participantType: "doctor",
    paymentType: "full",
    unitAmount: 12_180_000
  },
  {
    envName: "STRIPE_PRICE_DOCTOR_MXN_DEPOSIT",
    participantType: "doctor",
    paymentType: "deposit",
    unitAmount: 6_090_000
  },
  {
    envName: "STRIPE_PRICE_PATIENT_MXN_FULL",
    participantType: "patient",
    paymentType: "full",
    unitAmount: 1_624_000
  },
  {
    envName: "STRIPE_PRICE_PATIENT_MXN_DEPOSIT",
    participantType: "patient",
    paymentType: "deposit",
    unitAmount: 812_000
  }
] as const;

function stripe<T extends object>(args: string[]) {
  const output = execFileSync("stripe", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  const parsed = JSON.parse(output) as T | { error?: { message?: string; code?: string; type?: string } };
  if ("error" in parsed && parsed.error) {
    throw new Error(`${parsed.error.code || parsed.error.type || "stripe_error"}: ${parsed.error.message || "Stripe CLI request failed"}`);
  }
  return parsed as T;
}

function listProducts() {
  return stripe<StripeList<StripeProduct>>(["products", "list", "--live", "--limit", "100"]).data;
}

function listPrices(productId: string) {
  return stripe<StripeList<StripePrice>>(["prices", "list", "--live", "--limit", "100", "-d", `product=${productId}`]).data;
}

function findProduct(products: StripeProduct[], participantType: "doctor" | "patient") {
  return products.find(
    (product) =>
      product.livemode === true &&
      product.metadata?.app === "pilula" &&
      product.metadata?.environment === "live" &&
      product.metadata?.participant_type === participantType
  );
}

function createPrice(productId: string, config: (typeof PRICE_CONFIGS)[number]) {
  return stripe<StripePrice>([
    "prices",
    "create",
    "--live",
    "-d",
    `product=${productId}`,
    "-d",
    "currency=mxn",
    "-d",
    `unit_amount=${config.unitAmount}`,
    "-d",
    "tax_behavior=inclusive",
    "-d",
    "metadata[app]=pilula",
    "-d",
    "metadata[environment]=live",
    "-d",
    "metadata[managed_by]=pilula_checkout",
    "-d",
    `metadata[participant_type]=${config.participantType}`,
    "-d",
    `metadata[payment_type]=${config.paymentType}`,
    "-d",
    "metadata[base_currency]=usd",
    "-d",
    "metadata[charge_currency]=mxn",
    "-d",
    `metadata[fx_rate]=${FIXED_FX_RATE}`,
    "-d",
    "metadata[iva_included]=true"
  ]);
}

const products = listProducts();
if (!products.length || products.some((product) => product.livemode !== true)) {
  throw new Error("Stripe LIVE no confirmado: products.list devolvió recursos no live o vacío.");
}

const ids: Record<string, string> = {};
for (const config of PRICE_CONFIGS) {
  const product = findProduct(products, config.participantType);
  if (!product) throw new Error(`No se encontró Product LIVE existente para ${config.participantType}.`);
  const existing = listPrices(product.id).find(
    (price) =>
      price.active &&
      price.livemode === true &&
      price.currency === "mxn" &&
      price.unit_amount === config.unitAmount &&
      price.tax_behavior === "inclusive" &&
      price.metadata?.app === "pilula" &&
      price.metadata?.environment === "live" &&
      price.metadata?.participant_type === config.participantType &&
      price.metadata?.payment_type === config.paymentType &&
      price.metadata?.fx_rate === FIXED_FX_RATE
  );
  const price = existing || createPrice(product.id, config);
  if (price.livemode !== true) throw new Error(`${price.id} no es livemode=true.`);
  ids[config.envName] = price.id;
}

console.log("Stripe MXN LIVE Prices listos.");
for (const [name, id] of Object.entries(ids)) {
  console.log(`${name}=${id}`);
}
