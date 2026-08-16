import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";

/** Saves a single reusable content block (e.g. one proposal section) to the company's
 *  library — the "Kütüphaneme ekle" action in the AI draft preview. */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Bu özellik için giriş yapmalısın." }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 });

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
