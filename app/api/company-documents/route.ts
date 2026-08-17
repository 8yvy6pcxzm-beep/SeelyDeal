import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";
import { planAllows } from "@/lib/plan";

/** Saves a single reusable content block (e.g. one proposal section or block) to the
 *  company's library — the "Kütüphaneme ekle" / "Kütüphaneye Kaydet" action in the AI
 *  draft preview and editor. Gated the same way the AI tool layer gates
 *  search_content_library/add_text_block_from_library (see app/api/draft-proposal/tools.ts)
 *  so Lite-plan users can't grow a library they have no UI to use. */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Bu özellik için giriş yapmalısın." }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 });

  const { data: company } = await service.from("companies").select("plan").eq("id", profile.company_id).maybeSingle();
  if (!planAllows(company?.plan, "document_library")) {
    return NextResponse.json({ error: "İçerik Kütüphanesi Pro ve Custom paketlerinde kullanılabilir." }, { status: 403 });
  }

  const { title, content } = (await req.json()) as { title?: string; content?: string };
  if (!content || !content.trim()) {
    return NextResponse.json({ error: "Kaydedilecek metin boş." }, { status: 400 });
  }

  const { data: doc, error } = await service
    .from("company_documents")
    .insert({
      company_id: profile.company_id,
      type: "content_block",
      title: title?.trim() || "Başlıksız blok",
      content: content.trim(),
    })
    .select("id, type, title")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, document: doc });
}
