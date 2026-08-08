import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";

const TITLE = "Hizmetler ve Fiyatlandırma";

/** Upserts the onboarding-collected services/pricing summary as a `service_description`
 * row in company_documents (see Company Profile → "Varsayılan içerik") — this is the
 * same doc type/library a company can also edit by hand, so it shows up as a normal
 * document there and feeds every future proposal draft via the VARSAYILAN İÇERİK block
 * in app/api/draft-proposal/route.ts. One canonical row per company; re-running
 * onboarding (or the AI re-confirming this info) updates it instead of duplicating it. */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const { content } = (await req.json()) as { content?: string };
  if (!content?.trim()) return NextResponse.json({ error: "İçerik boş olamaz." }, { status: 400 });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 });

  const { data: existing } = await service
    .from("company_documents")
    .select("id")
    .eq("company_id", profile.company_id)
    .eq("type", "service_description")
    .eq("title", TITLE)
    .maybeSingle();

  const { error } = existing
    ? await service.from("company_documents").update({ content: content.trim() }).eq("id", existing.id)
    : await service
        .from("company_documents")
        .insert({ company_id: profile.company_id, type: "service_description", title: TITLE, content: content.trim() });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
