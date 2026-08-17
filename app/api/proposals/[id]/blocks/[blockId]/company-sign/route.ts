import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";

/** Authenticated counterpart to ../sign/route.ts: lets a logged-in company
 *  member sign a Legal/ContractSignOff block on behalf of the company (the
 *  `signer_role: "company"` row in block_signatures), from inside the app
 *  rather than the public client-facing OTP flow. No OTP here — the caller
 *  is already an authenticated Supabase session. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; blockId: string }> }) {
  const { id, blockId } = await params;
  const body = await req.json().catch(() => ({}));
  const blockType: string | undefined = body?.blockType;

  if (!blockType || !["Legal", "ContractSignOff"].includes(blockType)) {
    return NextResponse.json({ error: "Geçersiz blok tipi." }, { status: 400 });
  }

  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profili bulunamadı." }, { status: 404 });

  const { data: proposal } = await service
    .from("proposals")
    .select("id, blocks, companies(name)")
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .maybeSingle();
  if (!proposal) return NextResponse.json({ error: "Teklif bulunamadı." }, { status: 404 });

  const blocks = Array.isArray(proposal.blocks) ? (proposal.blocks as { id: string; type: string }[]) : [];
  const block = blocks.find((b) => b.id === blockId);
  if (!block || block.type !== blockType) {
    return NextResponse.json({ error: "Blok bu teklifte bulunamadı." }, { status: 404 });
  }

  const companyName = (proposal.companies as { name: string } | null)?.name ?? null;
  const signerName: string = body?.signerName?.trim() || companyName || "Şirket";

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
  const userAgent = req.headers.get("user-agent") || null;

  const { data: signature, error } = await service
    .from("block_signatures")
    .upsert(
      {
        proposal_id: id,
        block_id: blockId,
        block_type: blockType,
        signer_role: "company",
        signer_name: signerName,
        signer_email: user.email ?? null,
        otp_verified: true,
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
