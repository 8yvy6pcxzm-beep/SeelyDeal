import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";

const DOCX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Extracts the exact text of an uploaded PDF/Word file and stores it as a company document (e.g. a proposal template). */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Bu özellik için giriş yapmalısın." }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 });

  const { fileName, mediaType, base64, title, type } = (await req.json()) as {
    fileName: string;
    mediaType: string;
    base64: string;
    title?: string;
    type?: "contract" | "proposal_template" | "service_description" | "other";
  };

  if (!base64 || !mediaType) {
    return NextResponse.json({ error: "Dosya eksik." }, { status: 400 });
  }

  const buffer = Buffer.from(base64, "base64");
  let content: string;

  try {
    if (mediaType === "application/pdf") {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      content = result.text.trim();
    } else if (mediaType === DOCX_MEDIA_TYPE) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      content = result.value.trim();
    } else {
      return NextResponse.json({ error: "Sadece PDF veya Word (.docx) dosyaları desteklenir." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Dosyadan metin çıkarılamadı." }, { status: 422 });
  }

  if (!content) {
    return NextResponse.json({ error: "Dosyada okunabilir metin bulunamadı." }, { status: 422 });
  }

  const { data: doc, error } = await service
    .from("company_documents")
    .insert({
      company_id: profile.company_id,
      type: type ?? "proposal_template",
      title: title || fileName || "Yüklenen doküman",
      content,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ document: doc });
}
