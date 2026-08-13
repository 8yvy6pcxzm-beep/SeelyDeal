import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";
import { isSeelyDealPricingLeak } from "@/lib/seelydeal-pricing-leak";
import { PROPOSAL_FONT_KEYS, isProposalFontKey } from "@/lib/proposal-fonts";

export const maxDuration = 60;

const MODEL = "claude-sonnet-5";
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 15 * 1024 * 1024;

/** Onboarding Step 3 ("örnek teklifini paylaş") sends the uploaded file here — a
 * single, non-conversational vision call that reads a sample proposal / letterhead /
 * site screenshot and returns structured fields the wizard pre-fills: a services/
 * pricing summary, a display-font classification (see lib/proposal-fonts.ts), whether
 * this reads as a full proposal worth saving as the company's default template, and
 * — for images only — whether the image itself is good enough to use directly as the
 * proposal cover (the wizard falls back to a generated brand-color gradient otherwise,
 * see /api/settings/cover-image/generate). No back-and-forth chat, one shot in/out. */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const { mediaType, base64, fileName } = (await req.json()) as {
    mediaType?: string;
    base64?: string;
    fileName?: string;
  };
  if (!mediaType || !base64) return NextResponse.json({ error: "Dosya eksik." }, { status: 400 });

  const isPdf = mediaType === "application/pdf";
  const isImage = ACCEPTED_IMAGE_TYPES.includes(mediaType);
  if (!isPdf && !isImage) {
    return NextResponse.json({ error: "Sadece PDF, PNG, JPG veya WEBP kabul edilir." }, { status: 400 });
  }

  const buffer = Buffer.from(base64, "base64");
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Dosya en fazla 15MB olabilir." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 });

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const contentBlock = isPdf
    ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64 } }
    : {
        type: "image" as const,
        source: { type: "base64" as const, media_type: mediaType as "image/png" | "image/jpeg" | "image/webp", data: base64 },
      };

  const prompt = `Ekteki dosya (${fileName || "yüklenen dosya"}), bir şirketin daha önce hazırladığı örnek bir teklif, antetli kağıdı ya da sitesinin ekran görüntüsü olabilir. Bunu incele ve SADECE aşağıdaki JSON şeklinde, tek bir \`\`\`json\`\`\` bloğu içinde cevap ver, başka hiçbir metin yazma:

{
  "servicesSummary": "Dosyada geçen hizmetlerin ve fiyatlandırma yaklaşımının kısa, net bir özeti (madde madde olabilir, örn. \\"- Web sitesi tasarımı: 2000$ sabit ücret\\"). Dosyada hizmet/fiyat bilgisi yoksa boş string bırak.",
  "fontKey": "${PROPOSAL_FONT_KEYS.join('" | "')}" (dosyadaki baskın yazı tipinin görsel karakterine en yakın seçenek — "default": standart/modern sans-serif, "bold": kalın/iddialı/büyük başlıklı bir görsel dil, "elegant": zarif/ince serif ya da klasik bir görsel dil. Emin değilsen "default" yaz.),
  "isFullProposalExample": true veya false (dosya gerçek, tam bir teklif örneğiyse true; sadece bir logo/antet/site görüntüsüyse false),
  "extractedText": "SADECE isFullProposalExample true ise doldur: dosyanın düz metin içeriğini, başlıkları/bölümleri koruyarak (ör. 'Kapsam:\\n...\\nFiyatlandırma:\\n...') özetlemeden aktar. isFullProposalExample false ise boş string bırak.",
  "coverWorthy": true veya false (SADECE dosya bir GÖRSELSE anlamlı — dosya görsel değilse false yaz; görselse: bu görsel, kırpılmadan/olduğu gibi bir teklifin kapak/hero arka planı olarak kullanılabilecek kadar görsel açıdan zengin ve marka hissi taşıyan bir görsel mi? Sade bir ekran görüntüsü, düz metin sayfası ya da sadece bir logo ise false yaz.)
}

ÇOK ÖNEMLİ: Bu şirketin KENDİ hizmet/fiyat bilgisini çıkar — bizim (SeelyDeal'ın) kendi Lite/Pro/Custom abonelik paketleriyle bir ilgisi yok, öyle bir şey görürsen görmezden gel.`;

  let response;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: "user" as const, content: [contentBlock, { type: "text" as const, text: prompt }] }],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI yanıt veremedi.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const replyText = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const jsonMatch = replyText.match(/```json\s*([\s\S]*?)```/);
  let parsed: {
    servicesSummary?: string;
    fontKey?: string;
    isFullProposalExample?: boolean;
    extractedText?: string;
    coverWorthy?: boolean;
  } | null = null;
  if (jsonMatch) {
    try {
      parsed = JSON.parse(jsonMatch[1]);
    } catch {
      parsed = null;
    }
  }
  if (!parsed) return NextResponse.json({ error: "Dosya analiz edilemedi." }, { status: 502 });

  let servicesSummary = parsed.servicesSummary?.trim() || "";
  if (servicesSummary && isSeelyDealPricingLeak(servicesSummary)) servicesSummary = "";

  const fontKey = isProposalFontKey(parsed.fontKey) ? parsed.fontKey : "default";
  const isFullProposalExample = parsed.isFullProposalExample === true;
  const extractedText = isFullProposalExample ? parsed.extractedText?.trim() || "" : "";
  const coverWorthy = isImage && parsed.coverWorthy === true;

  let coverUrl: string | null = null;
  if (coverWorthy) {
    const ext = mediaType === "image/png" ? "png" : mediaType === "image/webp" ? "webp" : "jpg";
    const path = `${profile.company_id}/cover.${ext}`;
    const { error: uploadError } = await service.storage
      .from("covers")
      .upload(path, buffer, { contentType: mediaType, upsert: true });
    if (!uploadError) {
      const { data: publicUrlData } = service.storage.from("covers").getPublicUrl(path);
      coverUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;
    }
  }

  return NextResponse.json({ servicesSummary, fontKey, isFullProposalExample, extractedText, coverUrl });
}
