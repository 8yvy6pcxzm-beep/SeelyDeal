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

  // Full-content fields — set when the AI draft chat updates an already-saved
  // proposal (see components/app/ai-draft-dialog.tsx: continues editing after
  // the first save instead of only being able to create new proposals).
  if (body.title !== undefined) patch.title = body.title || "Yeni teklif";
  if (body.value !== undefined) {
    const numericValue = Number(body.value);
    patch.value = Number.isFinite(numericValue) ? numericValue : 0;
  }
  if (body.sections !== undefined) patch.sections = Array.isArray(body.sections) ? body.sections : [];
  // Typed blocks (see lib/types/proposal-blocks.ts) — e.g. Legal blocks copied
  // from the Content Library. Always written to *this* proposal's `blocks`
  // column only; never touches `company_documents` or `templates`.
  if (body.blocks !== undefined) patch.blocks = Array.isArray(body.blocks) ? body.blocks : [];
  if (body.contractText !== undefined) patch.contract_text = body.contractText || null;
  if (body.introText !== undefined) patch.intro_text = body.introText || null;
  if (body.aboutText !== undefined) patch.about_text = body.aboutText || null;
  if (body.clientContact !== undefined) {
    patch.client_contact = body.clientContact && typeof body.clientContact === "object" ? body.clientContact : {};
  }
  if (body.nextSteps !== undefined) patch.next_steps = Array.isArray(body.nextSteps) ? body.nextSteps : [];
  if (body.validDays !== undefined) {
    const validDays = Number(body.validDays);
    patch.valid_days = Number.isFinite(validDays) ? validDays : 15;
  }
  if (body.templateId !== undefined) patch.template_id = body.templateId || null;
  if (body.format === "pdf" || body.format === "html") patch.format = body.format;
  if (body.viewMode === "pages" || body.viewMode === "scroll") patch.view_mode = body.viewMode;
  if (body.client) {
    const { data: existing } = await service
      .from("clients")
      .select("id")
      .eq("company_id", profile.company_id)
      .eq("name", body.client)
      .maybeSingle();
    patch.client_id = existing
      ? existing.id
      : (await service.from("clients").insert({ company_id: profile.company_id, name: body.client }).select("id").single()).data?.id ?? null;
  }

  const { error } = await service
    .from("proposals")
    .update(patch)
    .eq("id", id)
    .eq("company_id", profile.company_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profili bulunamadı." }, { status: 404 });

  const { error } = await service
    .from("proposals")
    .delete()
    .eq("id", id)
    .eq("company_id", profile.company_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
