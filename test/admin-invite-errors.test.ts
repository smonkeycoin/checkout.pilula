import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyInviteCreateError,
  inviteCreateErrorResponse,
  logPaymentInviteCreateError
} from "@/lib/admin-invite-errors";

describe("admin invite error diagnostics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    [{ code: "42P01", message: "relation public.payment_invites does not exist" }, "INVITE_TABLE_MISSING"],
    [{ code: "42703", message: "column payment_currency does not exist" }, "INVITE_COLUMN_MISSING"],
    [{ code: "23514", message: "new row violates check constraint" }, "INVITE_CONSTRAINT_VIOLATED"],
    [{ code: "42501", message: "permission denied for table payment_invites" }, "INVITE_PERMISSION_DENIED"],
    [new Error("La moneda MXN requiere tipo de cambio"), "INVITE_MXN_RATE_MISSING"],
    [{ code: "RESEND_ERROR", message: "Domain is not verified" }, "INVITE_EMAIL_FAILED"]
  ])("clasifica %s como %s", (error, code) => {
    expect(classifyInviteCreateError(error)).toBe(code);
  });

  it("mantiene respuesta publica segura para fallos internos de insert", () => {
    expect(inviteCreateErrorResponse({ code: "42P01", message: "relation public.payment_invites does not exist" })).toEqual({
      error: "No se pudo crear la invitación.",
      code: "INVITE_INSERT_FAILED"
    });
  });

  it("redacta datos sensibles antes de escribir logs", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logPaymentInviteCreateError({
      code: "23505",
      message: "duplicate key user@example.com sk_live_secret abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef",
      details: "token_hash abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef",
      hint: "use another email"
    });

    expect(spy).toHaveBeenCalledWith("[payment_invites:create]", {
      code: "23505",
      message: "duplicate key [redacted_email] [redacted_secret] [redacted_token]",
      details: "token_hash [redacted_token]",
      hint: "use another email"
    });
  });
});
