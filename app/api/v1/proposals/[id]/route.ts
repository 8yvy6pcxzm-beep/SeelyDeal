import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { authenticateApiKey, apiAuthError } from "@/lib/api-key-auth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return apiAuthError(auth);

  const { id } = await params;
  const service = createServiceClient();
  const { data: proposal, error } = await service
    .from("proposals")
    .select("*, clients(name)")
    .eq("id", id)
    .eq("company_id", auth.companyId)
    .maybeSingle();

  if (error || !proposal) return NextResponse.json({ error: "Teklif bulunamadı." }, { status: 404 });
  return NextResponse.json({ proposal });
}
