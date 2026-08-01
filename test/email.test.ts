import { beforeEach, describe, expect, it, vi } from "vitest";

const resendMocks = vi.hoisted(() => ({
  send: vi.fn()
}));

vi.mock("resend", () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: resendMocks.send
    }
  }))
}));

describe("sendResendEmail", () => {
  beforeEach(() => {
    vi.resetModules();
    resendMocks.send.mockReset();
    process.env.RESEND_API_KEY = "re_test";
  });

  it("devuelve sent true cuando Resend devuelve data.id", async () => {
    resendMocks.send.mockResolvedValue({ data: { id: "email_123" }, error: null });
    const { sendResendEmail } = await import("@/lib/email");

    await expect(sendResendEmail({ from: "a@example.com", to: "b@example.com", subject: "x", html: "<p>x</p>" })).resolves.toEqual({
      sent: true,
      emailId: "email_123"
    });
  });

  it("devuelve sent false cuando Resend devuelve error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    resendMocks.send.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "Domain not verified", statusCode: 403 }
    });
    const { sendResendEmail } = await import("@/lib/email");

    await expect(sendResendEmail({ from: "a@example.com", to: "b@example.com", subject: "x", html: "<p>x</p>" })).resolves.toEqual({
      sent: false,
      reason: "resend_error",
      errorCode: "validation_error"
    });
  });

  it("devuelve sent false cuando Resend no devuelve data ni error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    resendMocks.send.mockResolvedValue({ data: null, error: null });
    const { sendResendEmail } = await import("@/lib/email");

    await expect(sendResendEmail({ from: "a@example.com", to: "b@example.com", subject: "x", html: "<p>x</p>" })).resolves.toEqual({
      sent: false,
      reason: "missing_email_id"
    });
  });
});
