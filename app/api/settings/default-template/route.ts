import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";

const TITLE = "Varsayılan Teklif Şablonu";

/** Upserts an onboarding-approved example proposal as a `proposal_template` row in
 * company_documents, marked as the default (see Company Profile → "Varsayılan
 * içerik") — this is the same doc type/library a company can also manage by hand.
 * app/api/draft-proposal/route.ts already reads whichever proposal_template doc has
 * is_default_template=true and follows its structure/tone for every future draft,
 * so this route is the only piece needed to wire onboarding into that. One
 * canonical row per company; re-approving updates it instead of duplicating it. */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const { content } = (await req.json()) as { content?: string };
  if (!content?.trim()) return NextResponse.json({ error: "İçerik boş olamaz." }, { status: 400 });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 });

  // Only one proposal_template doc can be "the default" at a time (mirrors the
  // manual toggle in Company Profile → Varsayılan içerik) — clear any other
  // before setting this one.
  await service
    .from("company_documents")
    .update({ is_default_template: false })
    .eq("company_id", profile.company_id)
    .eq("type", "proposal_template");

  const { data: existing } = await service
    .from("company_documents")
    .select("id")
    .eq("company_id", profile.company_id)
    .eq("type", "proposal_template")
    .eq("title", TITLE)
    .maybeSingle();

  const { error } = existing
    ? await service.from("company_documents").update({ content: content.trim(), is_default_template: true }).eq("id", existing.id)
    : await service.from("company_documents").insert({
        company_id: profile.company_id,
        type: "proposal_template",
        title: TITLE,
        content: content.trim(),
        is_default_template: true,
      });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
