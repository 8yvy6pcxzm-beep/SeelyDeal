import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";
import appConfig, { aiOveragePack } from "@/app.config";
import { safeFetchWebsiteText } from "@/lib/safe-fetch-website";

const MODEL = "claude-sonnet-5";

type ChatMessage = { role: "user" | "assistant"; content: string };
type Attachment = { name: string; mediaType: string; base64: string };

export async function POST(req: Request) {
  const { messages, websiteUrl, attachment } = (await req.json()) as {
    messages: ChatMessage[];
    websiteUrl?: string;
    attachment?: Attachment;
  };

  const user = await getAuthedUser(req);

  if (!user) {
    return NextResponse.json({ error: "Bu özellik için giriş yapmalısın." }, { status: 401 });
  }

  const service = createServiceClient();

  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 });
  }

  const [{ data: company }, { data: team }, { data: docs }] = await Promise.all([
    service.from("companies").select("*").eq("id", profile.company_id).single(),
    service.from("team_members").select("name, title").eq("company_id", profile.company_id),
    service.from("company_documents").select("type, title, content, is_default_template").eq("company_id", profile.company_id),
  ]);

  // Enforce the plan's monthly AI draft limit.
  const month = new Date().toISOString().slice(0, 7);
  const { data: usage } = await service
    .from("ai_usage")
    .select("count")
    .eq("company_id", profile.company_id)
    .eq("month", month)
    .maybeSingle();

  const limit: number = company?.ai_monthly_limit ?? 10;
  const used = usage?.count ?? 0;
  if (used >= limit) {
    return NextResponse.json(
      {
        error: `Bu ayki AI teklif hakkın (${limit}) doldu.`,
        overageLink: company?.overage_link ?? null,
        overagePrice: aiOveragePack.price,
        overageDrafts: aiOveragePack.extraDrafts,
      },
      { status: 429 },
    );
  }

  let websiteContext = "";
  if (websiteUrl) {
    const text = await safeFetchWebsiteText(websiteUrl);
    websiteContext = text
      ? `\n\nMüşterinin paylaştığı web sitesinden (${websiteUrl}) çıkarılan metin (marka dili/tonu ve hizmetleri anlamak için):\n"""${text}"""`
      : `\n\nNot: verilen web sitesi (${websiteUrl}) çekilemedi — kullanıcıya bilgiyi manuel anlatmasını iste.`;
  }

  type Doc = { type: string; title: string; content: string; is_default_template: boolean };
  const docsBlock = (docs ?? [])
    .map((d: Doc) => `- [${d.type}] "${d.title}":\n${d.content}`)
    .join("\n\n");

  const defaultTemplate: Doc | undefined =
    (docs ?? []).find((d: Doc) => d.type === "proposal_template" && d.is_default_template) ??
    (docs ?? []).find((d: Doc) => d.type === "proposal_template");

  const pricingBlock = appConfig.marketing.pricing
    .map((p) => `${p.name}: ${p.price}${p.period ? p.period.tr : ""} — ${p.features.map((f) => f.tr).join(", ")}`)
    .join("\n");

  const teamBlock = (team ?? [])
    .map((m: { name: string; title: string | null }) => `${m.name}${m.title ? ` (${m.title})` : ""}`)
    .join(", ");

  const companyBlock = `${company?.name ?? ""}${company?.email ? ` · ${company.email}` : ""} · ${appConfig.domain}`;

  const systemPrompt = `Sen ${company?.name ?? "bu işletme"} için çalışan bir teklif yazım asistanısın. Kullanıcı (işletme sahibi/çalışanı) seninle doğal, konuşma diliyle iletişim kurar ve senden müşterileri için teklif hazırlamanı ister.

KURALLAR:
- Türkçe konuş (kullanıcı İngilizce yazarsa İngilizce cevap ver).
- Teklif hazırlamak için gerekli bilgiler eksikse (müşteri adı, sunulacak hizmet, fiyatlandırma yaklaşımı) TEK TEK, doğal bir sohbet diliyle sor. Kullanıcı "nelere ihtiyacın var" derse hepsini liste halinde sun.
- Müşterinin web sitesini ASLA kendin tahmin etme veya arama; sadece kullanıcı paylaşırsa kullan. Paylaşmadıysa ve faydalı olacaksa nazikçe sor ("müşterinin web sitesini paylaşır mısın?").
- Kullanıcı bir dosya (PDF, resim, ekran görüntüsü) eklerse, içeriğini oku ve teklif için gereken bilgileri (marka, fiyatlandırma, kapsam, müşteri bilgisi vb.) oradan çıkar — tekrar sorma.
- Kullanıcı "standart sözleşmemi/teklif formatımı kullan, şunu revize et" derse, aşağıdaki DOKÜMAN KÜTÜPHANESİ'nden ilgili dokümanı bul, verdiği talimatlara göre revize ederek kullan.
- Fiyatlandırmada, aksi istenmedikçe aşağıdaki GERÇEK PAKETLERİMİZİ kullan.
- Kullanıcı bir kalemi "opsiyonel" veya "ek hizmet" olarak belirtirse, o kalemi \`optional: true\` yap (müşteri bunu teklifi görüntülerken açıp kapatabilir). \`included\` alanı, opsiyonel kalemin varsayılan olarak işaretli gelip gelmeyeceğini belirtir (belirtilmediyse false).
- Kullanıcı "aylık veya yıllık" gibi müşterinin ikisinden birini seçeceği farklı fiyatlı ödeme sıklığı/paket seçenekleri isterse, bunları \`billingOptions\` dizisine yaz (her biri ayrı fiyat, müşteri teklifi imzalamadan önce birini seçer). Bu, tekil kalemlerden farklıdır — kalemler teklife toplam olarak eklenir/çıkarılır, billingOptions ise birbirini DIŞLAYAN seçeneklerdir (biri seçilir, diğerleri değil).
- Teklifi SADE mi yoksa DETAYLI mı hazırlayacağına karar verirken şu sırayla ilerle:
  1. Kullanıcı açıkça "sade/basit hazırla" derse, DOĞRUDAN onu uygula (SADE) — bu her zaman en öncelikli kuraldır, başka hiçbir ipucuna bakma.
  2. Kullanıcı DOKÜMAN KÜTÜPHANESİ'nden belirli bir "teklif formatı" adı verip onu istediyse, o şablonun yapısını birebir takip et (DETAYLI).
  3. Aksi belirtilmedikçe, aşağıda VARSAYILAN TEKLİF ŞABLONU verilmişse onu KULLANMAK ZORUNLUSUN: serbest/improvize nesir yazma, şablonun bölüm sırasını ve başlıklarını birebir takip et (Ön Yazı → Hakkımızda → Taraflar → Hizmet Kapsamı → Paket/Ücret → Sözleşme Koşulları → Sonraki Adımlar gibi) ve \`introText\`, \`aboutText\`, \`clientContact\`, \`nextSteps\`, \`validDays\` alanlarını doldur (DETAYLI). Kullanıcı "sade" demediği sürece bunu atlama.
  4. VARSAYILAN TEKLİF ŞABLONU yoksa kendin karar ver: kullanıcı muhatabın adı/unvanı/adresi gibi bilgiler verdiyse, resmi bir üslup kullandıysa veya "resmi teklif", "sözleşme gibi olsun" dediyse → DETAYLI hazırla ve \`introText\`, \`aboutText\`, \`clientContact\`, \`nextSteps\`, \`validDays\` alanlarını da doldur. Kullanıcı sadece hızlıca kapsam + fiyat istediyse, muhatap hakkında bilgi vermediyse → SADE hazırla, bu alanları boş/undefined bırak, sadece title/client/value/sections/lineItems/billingOptions/contractText doldur.
  - \`introText\`: "Sayın [muhatap adı]," ile başlayan, görüşmeyi hatırlatan, 2-3 cümlelik resmi ama sıcak bir ön yazı.
  - \`aboutText\`: Şirketin ne iş yaptığını anlatan kısa bir "hakkımızda" paragrafı (şirket bilgilerinden ve dokümanlardan yararlan).
  - \`clientContact\`: Müşteri hakkında bildiğin bilgiler {"company": "...", "contactName": "...", "title": "...", "address": "...", "phone": "...", "email": "...", "website": "..."} — kullanıcı vermediği alanları boş bırak, UYDURMA.
  - \`nextSteps\`: Teklif kabul edildikten sonraki süreç, 3-5 adımlık {"title": "...", "body": "..."} dizisi (örn. Ödeme, Kurulum, Eğitim, Kullanıma başlama).
  - \`validDays\`: Teklifin kaç gün geçerli olduğu (belirtilmediyse 15).
- Yeterli bilgi toplandığında, cevabının SONUNA \`\`\`json ... \`\`\` bloğu ekle. Bu blok şu şekilde olmalı:
{"title": "...", "client": "...", "value": <sayı, USD>, "introText": "...", "aboutText": "...", "clientContact": {"company": "...", "contactName": "...", "title": "...", "address": "...", "phone": "...", "email": "...", "website": "..."}, "sections": [{"title": "...", "body": "..."}], "lineItems": [{"name": "...", "qty": <sayı>, "unit": <sayı, USD>, "optional": <true/false, opsiyonel>, "included": <true/false, opsiyonel>}], "billingOptions": [{"key": "...", "label": {"tr": "...", "en": "..."}, "price": <sayı, USD>}] (opsiyonel, sadece birden fazla ödeme sıklığı seçeneği varsa doldur, yoksa boş dizi bırak), "nextSteps": [{"title": "...", "body": "..."}], "validDays": <sayı>, "contractText": "..." (varsa revize sözleşme, yoksa boş bırak)}
- Bu json bloğunu SADECE teklif gerçekten tamamlandığında ekle; hâlâ soru soruyorsan ekleme.

HAZIRLAYAN (bizim şirketimiz): ${companyBlock}

ŞİRKET EKİBİ: ${teamBlock || "(henüz eklenmedi)"}

DOKÜMAN KÜTÜPHANESİ:
${docsBlock || "(henüz doküman eklenmedi)"}

VARSAYILAN TEKLİF ŞABLONU:
${defaultTemplate ? `"${defaultTemplate.title}":\n${defaultTemplate.content}` : "(henüz eklenmedi — kullanıcı karar verene kadar kendi takdirine göre sade/detaylı seç)"}

GERÇEK PAKETLERİMİZ:
${pricingBlock}${websiteContext}`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const anthropicMessages = messages.map((m, i) => {
    const isLastUserMessage = i === messages.length - 1 && m.role === "user";
    if (isLastUserMessage && attachment) {
      const block =
        attachment.mediaType === "application/pdf"
          ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: attachment.base64 } }
          : { type: "image" as const, source: { type: "base64" as const, media_type: attachment.mediaType as any, data: attachment.base64 } };
      return { role: m.role, content: [block, { type: "text" as const, text: m.content }] };
    }
    return { role: m.role, content: m.content };
  });

  let response;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: anthropicMessages as any,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI yanıt veremedi.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const replyText = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");

  await service
    .from("ai_usage")
    .upsert({ company_id: profile.company_id, month, count: used + 1 }, { onConflict: "company_id,month" });

  const jsonMatch = replyText.match(/```json\s*([\s\S]*?)```/);
  let draft = null;
  if (jsonMatch) {
    try {
      draft = JSON.parse(jsonMatch[1]);
    } catch {
      draft = null;
    }
  }

  const reply = replyText.replace(/```json[\s\S]*?```/, "").trim();

  return NextResponse.json({ reply, draft, remaining: limit - used - 1 });
}
