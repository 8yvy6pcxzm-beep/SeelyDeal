import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/** Public e-sign action: marks the proposal accepted and hands back the agency's payment link. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const service = createServiceClient();
  const { data: proposal, error } = await service
    .from("proposals")
    .update({ status: "accepted", signed_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, payment_link")
    .maybeSingle();

  if (error || !proposal) return NextResponse.json({ error: "Teklif bulunamadı." }, { status: 404 });

  return NextResponse.json({ ok: true, paymentLink: proposal.payment_link ?? null });
}
