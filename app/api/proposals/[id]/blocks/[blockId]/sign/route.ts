import { NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";

/** Signs a single Legal/ContractSignOff block, independent of the whole-proposal
 *  "Accept & Sign" flow (see ../../sign/route.ts) — same OTP code/cooldown/attempt
 *  fields on `proposals` are reused so the client only ever verifies once per visit. */
const MAX_OTP_ATTEMPTS = 5;

function codesMatch(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string; blockId: string }> }) {
  const { id, blockId } = await params;
  const body = await req.json().catch(() => ({}));
  const blockType: string | undefined = body?.blockType;
  const signerName: string | undefined = body?.signerName;
  const signerEmail: string | undefined = body?.signerEmail;
  const otpCode: string | undefined = body?.otpCode;

  if (!blockType || !["Legal", "ContractSignOff"].includes(blockType)) {
    return NextResponse.json({ error: "Geçersiz blok tipi." }, { status: 400 });
  }
  if (!signerName?.trim()) {
    return NextResponse.json({ error: "İmzalamak için adını yazman gerekiyor." }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
  const userAgent = req.headers.get("user-agent") || null;

  const service = createServiceClient();

  const { data: existing } = await service
    .from("proposals")
    .select("otp_code, otp_expires_at, otp_attempts, companies(plan)")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: "Teklif bulunamadı." }, { status: 404 });

  const plan = (existing.companies as { plan: string } | null)?.plan ?? "lite";
  let otpVerified = false;
  if (plan !== "lite") {
    const attempts = existing.otp_attempts ?? 0;
    if (attempts >= MAX_OTP_ATTEMPTS) {
      return NextResponse.json({ error: "Çok fazla hatalı deneme. Yeni bir kod iste." }, { status: 429 });
    }
    const expired = !existing.otp_expires_at || new Date(existing.otp_expires_at) < new Date();
    const valid = !!otpCode?.trim() && !!existing.otp_code && !expired && codesMatch(otpCode.trim(), existing.otp_code);
    if (!valid) {
      await service.from("proposals").update({ otp_attempts: attempts + 1 }).eq("id", id);
      return NextResponse.json({ error: "Kod hatalı veya süresi dolmuş." }, { status: 400 });
    }
    otpVerified = true;
  }

  const { data: signature, error } = await service
    .from("block_signatures")
    .upsert(
      {
        proposal_id: id,
        block_id: blockId,
        block_type: blockType,
        signer_role: "client",
        signer_name: signerName.trim(),
        signer_email: signerEmail?.trim() || null,
        otp_verified: otpVerified,
        ip,
        user_agent: userAgent,
        signed_at: new Date().toISOString(),
      },
      { onConflict: "proposal_id,block_id,signer_role" },
    )
    .select("block_id, signer_name, signed_at")
    .single();

  if (error || !signature) return NextResponse.json({ error: "İmzalanamadı." }, { status: 500 });

  return NextResponse.json({ ok: true, signature });
}
