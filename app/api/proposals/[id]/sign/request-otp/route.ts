import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/server";

/** Sends a 6-digit email verification code before signing — required for Pro/Custom (plan !== "starter"), Lite skips this and signs directly. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const email: string | undefined = body?.email;

  if (!email?.trim()) {
    return NextResponse.json({ error: "Doğrulama kodu için email adresi gerekli." }, { status: 400 });
  }

  const service = createServiceClient();

  const { data: proposal } = await service
    .from("proposals")
    .select("id, company_id, companies(plan)")
    .eq("id", id)
    .maybeSingle();

  if (!proposal) return NextResponse.json({ error: "Teklif bulunamadı." }, { status: 404 });

  const plan = (proposal.companies as { plan: string } | null)?.plan ?? "starter";
  if (plan === "starter") {
    return NextResponse.json({ error: "Bu teklif için doğrulama kodu gerekmiyor." }, { status: 400 });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error } = await service
    .from("proposals")
    .update({ otp_code: code, otp_email: email.trim(), otp_expires_at: expiresAt })
    .eq("id", id);

  if (error) return NextResponse.json({ error: "Kod oluşturulamadı." }, { status: 500 });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Email gönderme servisi yapılandırılmamış." }, { status: 502 });
  }

  const resend = new Resend(apiKey);
  const { error: sendError } = await resend.emails.send({
    from: "SeelyDeal <elif@seelynow.info>",
    to: email.trim(),
    subject: "SeelyDeal — teklif imza doğrulama kodu",
    text: `Teklifi imzalamak için doğrulama kodun: ${code}\n\nBu kod 10 dakika geçerlidir.`,
  });

  if (sendError) return NextResponse.json({ error: "Email gönderilemedi." }, { status: 502 });

  return NextResponse.json({ ok: true });
}
