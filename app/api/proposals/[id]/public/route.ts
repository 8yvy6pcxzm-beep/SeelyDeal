import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/** Public, unauthenticated read of a single proposal — only the fields a client needs to view and sign. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const service = createServiceClient();
  const { data: proposal } = await service
    .from("proposals")
    .select("id, title, status, value, sections, line_items, contract_text, signed_at, clients(name)")
    .eq("id", id)
    .maybeSingle();

  if (!proposal) return NextResponse.json({ error: "Teklif bulunamadı." }, { status: 404 });

  if (proposal.status === "sent") {
    await service.from("proposals").update({ status: "viewed" }).eq("id", id);
    proposal.status = "viewed";
  }

  return NextResponse.json({ proposal });
}
