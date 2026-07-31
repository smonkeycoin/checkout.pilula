type DiagnosticInput = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

export type InviteCreateFailureCode =
  | "INVITE_TABLE_MISSING"
  | "INVITE_COLUMN_MISSING"
  | "INVITE_CONSTRAINT_VIOLATED"
  | "INVITE_INVALID_DATE"
  | "INVITE_MXN_RATE_MISSING"
  | "INVITE_PERMISSION_DENIED"
  | "INVITE_EMAIL_FAILED"
  | "INVITE_INSERT_FAILED";

export class PaymentInviteSupabaseError extends Error {
  code?: string;
  details?: string;
  hint?: string;

  constructor(error: DiagnosticInput) {
    super(error.message || "Supabase invite insert failed");
    this.name = "PaymentInviteSupabaseError";
    this.code = error.code || undefined;
    this.details = error.details || undefined;
    this.hint = error.hint || undefined;
  }
}

function diagnosticFrom(error: unknown): DiagnosticInput {
  if (error instanceof PaymentInviteSupabaseError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    };
  }

  if (error instanceof Error) {
    const maybeDiagnostic = error as Error & DiagnosticInput;
    return {
      code: maybeDiagnostic.code,
      message: error.message,
      details: maybeDiagnostic.details,
      hint: maybeDiagnostic.hint
    };
  }

  if (typeof error === "object" && error !== null) {
    const maybeDiagnostic = error as DiagnosticInput;
    return {
      code: maybeDiagnostic.code,
      message: maybeDiagnostic.message,
      details: maybeDiagnostic.details,
      hint: maybeDiagnostic.hint
    };
  }

  return { message: String(error) };
}

export function classifyInviteCreateError(error: unknown): InviteCreateFailureCode {
  const diagnostic = diagnosticFrom(error);
  const code = diagnostic.code || "";
  const text = [diagnostic.message, diagnostic.details, diagnostic.hint].filter(Boolean).join(" ").toLowerCase();

  if (text.includes("moneda mxn requiere tipo de cambio") || text.includes("mxn requiere tipo de cambio")) {
    return "INVITE_MXN_RATE_MISSING";
  }
  if (text.includes("invalid date") || text.includes("fecha invalida") || code === "22007" || code === "22008") {
    return "INVITE_INVALID_DATE";
  }
  if (code === "42P01" || text.includes("relation") && text.includes("payment_invites") && text.includes("does not exist")) {
    return "INVITE_TABLE_MISSING";
  }
  if (code === "42703" || code === "PGRST204" || text.includes("could not find") && text.includes("column")) {
    return "INVITE_COLUMN_MISSING";
  }
  if (code === "42501" || text.includes("permission denied") || text.includes("violates row-level security")) {
    return "INVITE_PERMISSION_DENIED";
  }
  if (code.startsWith("23") || text.includes("violates") && text.includes("constraint")) {
    return "INVITE_CONSTRAINT_VIOLATED";
  }
  if (code === "RESEND_ERROR" || text.includes("resend") || text.includes("email")) {
    return "INVITE_EMAIL_FAILED";
  }

  return "INVITE_INSERT_FAILED";
}

function sanitizeLogText(value?: string | null) {
  if (!value) return value ?? null;
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted_email]")
    .replace(/\b(?:sk|rk|whsec|pk)_(?:live|test)_[A-Za-z0-9_]+\b/g, "[redacted_secret]")
    .replace(/\b[A-Fa-f0-9]{48,}\b/g, "[redacted_token]")
    .replace(/\b[A-Za-z0-9_-]{64,}\b/g, "[redacted_token]");
}

export function logPaymentInviteCreateError(error: unknown) {
  const diagnostic = diagnosticFrom(error);
  console.error("[payment_invites:create]", {
    code: sanitizeLogText(diagnostic.code || classifyInviteCreateError(error)),
    message: sanitizeLogText(diagnostic.message),
    details: sanitizeLogText(diagnostic.details),
    hint: sanitizeLogText(diagnostic.hint)
  });
}

export function inviteCreateErrorResponse(error: unknown) {
  const code = classifyInviteCreateError(error);
  if (code === "INVITE_INVALID_DATE") {
    return {
      error: "La fecha de vencimiento no es válida.",
      code
    };
  }
  if (code === "INVITE_MXN_RATE_MISSING") {
    return {
      error: "Falta la tasa MXN para crear la invitación.",
      code
    };
  }
  if (code === "INVITE_EMAIL_FAILED") {
    return {
      error: "La invitación fue creada, pero no se pudo enviar el email.",
      code
    };
  }

  return {
    error: "No se pudo crear la invitación.",
    code: "INVITE_INSERT_FAILED" as const
  };
}
