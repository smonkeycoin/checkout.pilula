import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminUnauthorizedBody, verifyAdminRequest } from "@/lib/admin-auth";
import { sendPaymentInviteEmail } from "@/lib/email";
import { buildPaymentInviteUrl, buildWhatsappUrl, createInviteToken, type PaymentInvite } from "@/lib/payment-invites";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const actionSchema = z.object({
  action: z.enum(["approve", "revoke", "resend"]),
  sendEmail: z.boolean().optional()
});

type Props = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Props) {
  const admin = await verifyAdminRequest(request);
  if (!admin.ok) return NextResponse.json(adminUnauthorizedBody(admin.reason), { status: 401 });

  const { id } = await params;
  const parsed = actionSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase no configurado" }, { status: 503 });

  if (parsed.data.action === "resend") {
    const { token, tokenHash } = createInviteToken();
    const { data, error } = await supabase
      .from("payment_invites")
      .update({ token_hash: tokenHash, status: "approved", approved_at: new Date().toISOString(), used_at: null, revoked_at: null })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: "No se pudo reenviar" }, { status: 500 });
    const invite = data as PaymentInvite;
    const url = buildPaymentInviteUrl(token);
    if (parsed.data.sendEmail) await sendPaymentInviteEmail(invite, url);
    return NextResponse.json({ ok: true, url, whatsappUrl: buildWhatsappUrl(invite, url) });
  }

  const update =
    parsed.data.action === "approve"
      ? { status: "approved", approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      : { status: "revoked", revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() };

  const { error } = await supabase.from("payment_invites").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
