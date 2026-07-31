import { describe, expect, it } from "vitest";
import {
  generateOtpCode,
  hashOtpCode,
  maskEmail,
  displayName,
  validateInviteOtpCookieValue
} from "@/lib/payment-invite-otp";

describe("payment invite OTP", () => {
  it("enmascara correo", () => {
    expect(maskEmail("trinopc1@gmail.com")).toBe("tr***@gmail.com");
  });

  it("normaliza nombre visual sin requerir mutar el dato fuente", () => {
    expect(displayName("  yOANNA   mArtínez  ", "fallback@example.com")).toBe("Yoanna Martínez");
  });

  it("genera codigos de 6 digitos", () => {
    expect(generateOtpCode()).toMatch(/^\d{6}$/);
  });

  it("hashea el OTP sin conservar texto plano", () => {
    const hash = hashOtpCode({
      inviteId: "11111111-1111-1111-1111-111111111111",
      email: "trinopc1@gmail.com",
      code: "123456"
    });

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain("123456");
    expect(hash).not.toContain("trinopc1");
  });

  it("rechaza cookies de verificacion manipuladas", () => {
    expect(validateInviteOtpCookieValue("invite.9999999999999.bad", "invite")).toBe(false);
  });
});
