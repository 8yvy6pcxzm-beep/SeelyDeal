import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/** Public, unauthenticated: records the buyer's current line-item/billing toggle state so the seller can watch it live (Smart Proposal, Custom-only). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const lineItems: { name: string; included?: boolean }[] | undefined = body?.lineItems;
  const billingKey: string | null | undefined = body?.billingKey;

  const service = createServiceClient();
  const { error } = await service
    .from("proposals")
    .update({
      live_selection: { lineItems: lineItems ?? [], billingKey: billingKey ?? null },
      live_selection_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
