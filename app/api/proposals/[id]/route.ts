import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profili bulunamadı." }, { status: 404 });

  const { data: proposal, error } = await service
    .from("proposals")
    .select("*, clients(name)")
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .maybeSingle();

  if (error || !proposal) return NextResponse.json({ error: "Teklif bulunamadı." }, { status: 404 });
  return NextResponse.json({ proposal });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profili bulunamadı." }, { status: 404 });

  const patch: Record<string, unknown> = {};
  if (body.status) patch.status = body.status;
  if (body.paymentLink !== undefined) patch.payment_link = body.paymentLink || null;
  if (body.billingOptions !== undefined) patch.billing_options = body.billingOptions;
  if (body.lineItems !== undefined) patch.line_items = body.lineItems;

  const { error } = await service
    .from("proposals")
    .update(patch)
    .eq("id", id)
    .eq("company_id", profile.company_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
