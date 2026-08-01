import crypto from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const PAYMENT_INVITE_OTP_COOKIE = "pilula_invite_email_verified";
export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_COOKIE_TTL_SECONDS = 20 * 60;
export const OTP_COOLDOWN_MS = 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_SENDS_PER_HOUR = 3;

type PaymentInviteOtpRow = {
  id: string;
  invite_id: string;
  code_hash: string;
  attempts: number;
  expires_at: string;
  created_at: string;
  email_sent_at: string | null;
  invalidated_at: string | null;
  verified_at: string | null;
};

function otpSecret() {
  const env = getEnv();
  return env.PAYMENT_INVITE_OTP_SECRET || env.INVOICE_LINK_SECRET || "pilula-local-otp-secret";
}

function hmac(value: string) {
  return crypto.createHmac("sha256", otpSecret()).update(value).digest("hex");
}

export function generateOtpCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtpCode(input: { inviteId: string; email: string; code: string }) {
  return hmac(`${input.inviteId}:${input.email.toLowerCase()}:${input.code}`);
}

function timingSafeEqualHex(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  if (!domain) return email;
  const prefix = local.slice(0, Math.min(2, local.length));
  return `${prefix}***@${domain}`;
}

export function displayName(name: string | null | undefined, fallback: string) {
  const source = (name || fallback).trim().replace(/\s+/g, " ");
  return source
    .split(" ")
    .map((part) => part ? part.charAt(0).toLocaleUpperCase("es-MX") + part.slice(1).toLocaleLowerCase("es-MX") : "")
    .join(" ");
}

function signedCookieValue(inviteId: string, expiresAt: number) {
  const payload = `${inviteId}.${expiresAt}`;
  return `${payload}.${hmac(payload)}`;
}

export function setInviteOtpCookie(response: NextResponse, inviteId: string) {
  const expiresAt = Date.now() + OTP_COOKIE_TTL_SECONDS * 1000;
  response.cookies.set(PAYMENT_INVITE_OTP_COOKIE, signedCookieValue(inviteId, expiresAt), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OTP_COOKIE_TTL_SECONDS
  });
}

export function validateInviteOtpCookieValue(value: string | undefined, inviteId: string) {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [cookieInviteId, expiresAtValue, signature] = parts;
  if (cookieInviteId !== inviteId) return false;
  const expiresAt = Number(expiresAtValue);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;
  const expected = hmac(`${cookieInviteId}.${expiresAtValue}`);
  return timingSafeEqualHex(signature, expected);
}

export function isInviteOtpVerified(request: NextRequest, inviteId: string) {
  return validateInviteOtpCookieValue(request.cookies.get(PAYMENT_INVITE_OTP_COOKIE)?.value, inviteId);
}

export function isInviteOtpVerifiedFromCookies(cookies: { get(name: string): { value: string } | undefined }, inviteId: string) {
  return validateInviteOtpCookieValue(cookies.get(PAYMENT_INVITE_OTP_COOKIE)?.value, inviteId);
}

export async function createInviteOtp(input: { inviteId: string; email: string }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false as const, reason: "not_configured" };

  const now = Date.now();
  const since = new Date(now - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("payment_invite_otps")
    .select("id", { count: "exact", head: true })
    .eq("invite_id", input.inviteId)
    .not("email_sent_at", "is", null)
    .is("invalidated_at", null)
    .gte("email_sent_at", since);

  if ((count || 0) >= OTP_MAX_SENDS_PER_HOUR) {
    return { ok: false as const, reason: "hourly_limit", retryAfterSeconds: 60 * 60 };
  }

  const { data: latest } = await supabase
    .from("payment_invite_otps")
    .select("email_sent_at")
    .eq("invite_id", input.inviteId)
    .not("email_sent_at", "is", null)
    .is("invalidated_at", null)
    .order("email_sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestSentAt = latest?.email_sent_at ? new Date(String(latest.email_sent_at)).getTime() : 0;
  const retryAfterMs = latestSentAt + OTP_COOLDOWN_MS - now;
  if (retryAfterMs > 0) {
    return { ok: false as const, reason: "cooldown", retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
  }

  const code = generateOtpCode();
  const expiresAt = new Date(now + OTP_TTL_MS).toISOString();
  const { data, error } = await supabase
    .from("payment_invite_otps")
    .insert({
      invite_id: input.inviteId,
      code_hash: hashOtpCode({ inviteId: input.inviteId, email: input.email, code }),
      sent_to_email: input.email.toLowerCase(),
      expires_at: expiresAt
    })
    .select("id")
    .single();

  if (error) return { ok: false as const, reason: "insert_failed" };

  return {
    ok: true as const,
    otpId: String(data?.id || ""),
    code,
    expiresAt,
    resendAvailableAt: new Date(now + OTP_COOLDOWN_MS).toISOString()
  };
}

export async function markInviteOtpEmailSent(otpId: string, emailId?: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase || !otpId) return { ok: false as const, reason: "not_configured" };

  const { error } = await supabase
    .from("payment_invite_otps")
    .update({
      email_sent_at: new Date().toISOString(),
      resend_email_id: emailId || null
    })
    .eq("id", otpId)
    .is("invalidated_at", null);

  return error ? { ok: false as const, reason: "update_failed" } : { ok: true as const };
}

export async function invalidateInviteOtp(otpId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase || !otpId) return { ok: false as const, reason: "not_configured" };

  const { error } = await supabase
    .from("payment_invite_otps")
    .update({
      invalidated_at: new Date().toISOString(),
      expires_at: new Date().toISOString(),
      attempts: OTP_MAX_ATTEMPTS
    })
    .eq("id", otpId)
    .is("verified_at", null);

  return error ? { ok: false as const, reason: "update_failed" } : { ok: true as const };
}

export async function verifyInviteOtp(input: { inviteId: string; email: string; code: string }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false as const, reason: "not_configured" };

  if (!/^\d{6}$/.test(input.code)) return { ok: false as const, reason: "invalid_code" };

  const now = new Date().toISOString();
  const { data } = await supabase
    .from("payment_invite_otps")
    .select("*")
    .eq("invite_id", input.inviteId)
    .not("email_sent_at", "is", null)
    .is("invalidated_at", null)
    .is("verified_at", null)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const otp = data as PaymentInviteOtpRow | null;
  if (!otp) return { ok: false as const, reason: "not_found_or_expired" };
  if (otp.attempts >= OTP_MAX_ATTEMPTS) return { ok: false as const, reason: "too_many_attempts" };

  const expectedHash = hashOtpCode({ inviteId: input.inviteId, email: input.email, code: input.code });
  if (!timingSafeEqualHex(otp.code_hash, expectedHash)) {
    await supabase.from("payment_invite_otps").update({ attempts: otp.attempts + 1 }).eq("id", otp.id);
    return { ok: false as const, reason: "invalid_code", attemptsRemaining: OTP_MAX_ATTEMPTS - otp.attempts - 1 };
  }

  const { error } = await supabase
    .from("payment_invite_otps")
    .update({ verified_at: now, attempts: otp.attempts + 1 })
    .eq("id", otp.id)
    .is("verified_at", null);

  if (error) return { ok: false as const, reason: "verify_failed" };
  return { ok: true as const };
}
