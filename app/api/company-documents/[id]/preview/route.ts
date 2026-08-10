import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";

/** Returns a short-lived signed URL to the original uploaded file, so the content
 *  library can show a real visual preview instead of just the extracted text. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 });

  const { data: doc } = await service
    .from("company_documents")
    .select("file_path, file_mime, file_name, company_id")
    .eq("id", id)
    .maybeSingle();

  if (!doc || doc.company_id !== profile.company_id) {
    return NextResponse.json({ error: "Doküman bulunamadı." }, { status: 404 });
  }
  if (!doc.file_path) {
    return NextResponse.json({ error: "Bu doküman için yüklenmiş bir dosya yok." }, { status: 404 });
  }

  const { data, error } = await service.storage.from("company-documents").createSignedUrl(doc.file_path, 120);
  if (error || !data) return NextResponse.json({ error: error?.message || "Önizleme oluşturulamadı." }, { status: 500 });

  return NextResponse.json({ url: data.signedUrl, mime: doc.file_mime, fileName: doc.file_name });
}
