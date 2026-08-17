import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";
import { planAllows } from "@/lib/plan";

const DOCX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const XLS_MEDIA_TYPE = "application/vnd.ms-excel";
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB

// Every format the library accepts, mapped to the file extension used when storing the
// original in Supabase Storage. Text is extracted where possible (PDF/Word/Excel) so the AI
// can read it; images and other binary formats are stored as-is with no extracted text.
const EXTENSION_BY_MEDIA_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  [DOCX_MEDIA_TYPE]: "docx",
  [XLSX_MEDIA_TYPE]: "xlsx",
  [XLS_MEDIA_TYPE]: "xls",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

// Formats that have no extractable text — an empty `content` is expected and not an error.
const NO_TEXT_MEDIA_TYPES = new Set(["image/png", "image/jpeg", "image/webp", XLSX_MEDIA_TYPE, XLS_MEDIA_TYPE]);

/** Stores an uploaded file (PDF, Word, Excel, or image) as a company document, extracting
 *  its text where possible so the AI can read it, and always keeping the original file. */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Bu özellik için giriş yapmalısın." }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 });

  const { data: company } = await service.from("companies").select("plan").eq("id", profile.company_id).maybeSingle();
  if (!planAllows(company?.plan, "document_library")) {
    return NextResponse.json({ error: "Doküman kütüphanesi Pro ve Custom paketlerinde kullanılabilir." }, { status: 403 });
  }

  const { fileName, mediaType, base64, title, type } = (await req.json()) as {
    fileName: string;
    mediaType: string;
    base64: string;
    title?: string;
    type?: "contract" | "proposal_template" | "service_description" | "other" | "reference" | "company_material";
  };

  if (!base64 || !mediaType) {
    return NextResponse.json({ error: "Dosya eksik." }, { status: 400 });
  }
  // Checked on the base64 string itself (before decoding) so an oversized
  // payload can't allocate a huge buffer just to get rejected afterward.
  if (base64.length > (MAX_FILE_BYTES * 4) / 3) {
    return NextResponse.json({ error: "Dosya çok büyük (en fazla 20MB)." }, { status: 413 });
  }

  const ext = EXTENSION_BY_MEDIA_TYPE[mediaType];
  if (!ext) {
    return NextResponse.json({ error: "Bu dosya türü desteklenmiyor." }, { status: 400 });
  }

  const buffer = Buffer.from(base64, "base64");
  let content = "";

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
    } else if (mediaType === XLSX_MEDIA_TYPE || mediaType === XLS_MEDIA_TYPE) {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      content = workbook.SheetNames.map((name) => {
        const sheet = workbook.Sheets[name];
        return `# ${name}\n${XLSX.utils.sheet_to_csv(sheet)}`;
      })
        .join("\n\n")
        .trim();
    }
    // Images and other non-text-extractable formats keep `content` empty — the original
    // file is still stored and can be previewed/downloaded.
  } catch {
    return NextResponse.json({ error: "Dosyadan metin çıkarılamadı." }, { status: 422 });
  }

  if (!content && !NO_TEXT_MEDIA_TYPES.has(mediaType)) {
    return NextResponse.json({ error: "Dosyada okunabilir metin bulunamadı." }, { status: 422 });
  }

  // Keep the original file too (not just the extracted text) so the library can show a real
  // visual preview of what was uploaded, rather than only the AI-readable text summary.
  const filePath = `${profile.company_id}/${crypto.randomUUID()}.${ext}`;
  const { error: storageError } = await service.storage
    .from("company-documents")
    .upload(filePath, buffer, { contentType: mediaType });

  const { data: doc, error } = await service
    .from("company_documents")
    .insert({
      company_id: profile.company_id,
      type: type ?? "proposal_template",
      title: title || fileName || "Yüklenen doküman",
      content,
      ...(storageError ? {} : { file_path: filePath, file_mime: mediaType, file_name: fileName || null }),
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ document: doc });
}
