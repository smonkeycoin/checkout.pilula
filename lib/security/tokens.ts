import crypto from "node:crypto";
import { getEnv } from "@/lib/env";

export function createOpaqueToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createSignedInvoiceToken(orderId: string, expiresAt: Date) {
  const env = getEnv();
  if (!env.INVOICE_LINK_SECRET) {
    return "";
  }
  const payload = `${orderId}.${expiresAt.getTime()}`;
  const signature = crypto.createHmac("sha256", env.INVOICE_LINK_SECRET).update(payload).digest("base64url");
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

export function verifySignedInvoiceToken(orderId: string, token: string) {
  const env = getEnv();
  if (!env.INVOICE_LINK_SECRET || !token) return false;

  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [signedOrderId, expires, signature] = decoded.split(".");
    if (signedOrderId !== orderId || !expires || !signature) return false;
    if (Number(expires) < Date.now()) return false;
    const expected = crypto.createHmac("sha256", env.INVOICE_LINK_SECRET).update(`${signedOrderId}.${expires}`).digest("base64url");
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
