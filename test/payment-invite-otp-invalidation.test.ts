import { describe, expect, it, vi } from "vitest";
import { OTP_MAX_ATTEMPTS } from "@/lib/payment-invite-otp";

const supabaseMocks = vi.hoisted(() => ({
  update: vi.fn(),
  eq: vi.fn(),
  is: vi.fn()
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: vi.fn(() => ({
      update: supabaseMocks.update
    }))
  }))
}));

describe("invalidateInviteOtp", () => {
  it("expira e invalida el OTP para que no quede activo", async () => {
    supabaseMocks.is.mockResolvedValue({ error: null });
    supabaseMocks.eq.mockReturnValue({ is: supabaseMocks.is });
    supabaseMocks.update.mockReturnValue({ eq: supabaseMocks.eq });

    const { invalidateInviteOtp } = await import("@/lib/payment-invite-otp");
    await expect(invalidateInviteOtp("otp_123")).resolves.toEqual({ ok: true });

    expect(supabaseMocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        invalidated_at: expect.any(String),
        expires_at: expect.any(String),
        attempts: OTP_MAX_ATTEMPTS
      })
    );
    expect(supabaseMocks.eq).toHaveBeenCalledWith("id", "otp_123");
    expect(supabaseMocks.is).toHaveBeenCalledWith("verified_at", null);
  });
});
