import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { authenticateApiKey, apiAuthError } from "@/lib/api-key-auth";

/** Public API — authenticated with a company's own `Authorization: Bearer sk_live_...` key. */
export async function GET(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return apiAuthError(auth);

  const service = createServiceClient();
  const { data: proposals, error } = await service
    .from("proposals")
    .select("id, title, status, value, created_at, clients(name)")
    .eq("company_id", auth.companyId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ proposals: proposals ?? [] });
}

export async function POST(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return apiAuthError(auth);

  const body = await req.json().catch(() => ({}));
  const { title, client, value, sections, lineItems, contractText, paymentLink, billingOptions } = body;

  const service = createServiceClient();

  let clientId: string | null = null;
  if (client) {
    const { data: existing } = await service.from("clients").select("id").eq("company_id", auth.companyId).eq("name", client).maybeSingle();
    if (existing) {
      clientId = existing.id;
    } else {
      const { data: created } = await service.from("clients").insert({ company_id: auth.companyId, name: client }).select("id").single();
      clientId = created?.id ?? null;
    }
  }

  const { data: proposal, error } = await service
    .from("proposals")
    .insert({
      company_id: auth.companyId,
      client_id: clientId,
      title: title || "Yeni teklif",
      value: value || 0,
      sections: sections || [],
      line_items: lineItems || [],
      contract_text: contractText || null,
      payment_link: paymentLink || null,
      billing_options: billingOptions || [],
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: proposal.id }, { status: 201 });
}
