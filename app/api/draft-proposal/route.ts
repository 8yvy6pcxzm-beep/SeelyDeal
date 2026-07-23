import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";
import appConfig from "@/app.config";
import { safeFetchWebsiteText } from "@/lib/safe-fetch-website";

const MODEL = "claude-sonnet-5";

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const { messages, websiteUrl } = (await req.json()) as {
    messages: ChatMessage[];
    websiteUrl?: string;
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
    service.from("company_documents").select("type, title, content").eq("company_id", profile.company_id),
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
      { error: `Bu ayki AI teklif hakkın (${limit}) doldu. Daha fazlası için paketini yükselt.` },
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

  const docsBlock = (docs ?? [])
    .map((d: { type: string; title: string; content: string }) => `- [${d.type}] "${d.title}":\n${d.content}`)
    .join("\n\n");

  const pricingBlock = appConfig.marketing.pricing
    .map((p) => `${p.name}: ${p.price}${p.period ? p.period.tr : ""} — ${p.features.map((f) => f.tr).join(", ")}`)
    .join("\n");

  const teamBlock = (team ?? [])
    .map((m: { name: string; title: string | null }) => `${m.name}${m.title ? ` (${m.title})` : ""}`)
    .join(", ");

  const systemPrompt = `Sen ${company?.name ?? "bu işletme"} için çalışan bir teklif yazım asistanısın. Kullanıcı (işletme sahibi/çalışanı) seninle doğal, konuşma diliyle iletişim kurar ve senden müşterileri için teklif hazırlamanı ister.

KURALLAR:
- Türkçe konuş (kullanıcı İngilizce yazarsa İngilizce cevap ver).
- Teklif hazırlamak için gerekli bilgiler eksikse (müşteri adı, sunulacak hizmet, fiyatlandırma yaklaşımı) TEK TEK, doğal bir sohbet diliyle sor. Kullanıcı "nelere ihtiyacın var" derse hepsini liste halinde sun.
- Müşterinin web sitesini ASLA kendin tahmin etme veya arama; sadece kullanıcı paylaşırsa kullan. Paylaşmadıysa ve faydalı olacaksa nazikçe sor ("müşterinin web sitesini paylaşır mısın?").
- Kullanıcı "standart sözleşmemi/teklif formatımı kullan, şunu revize et" derse, aşağıdaki DOKÜMAN KÜTÜPHANESİ'nden ilgili dokümanı bul, verdiği talimatlara göre revize ederek kullan.
- Fiyatlandırmada, aksi istenmedikçe aşağıdaki GERÇEK PAKETLERİMİZİ kullan.
- Yeterli bilgi toplandığında, cevabının SONUNA \`\`\`json ... \`\`\` bloğu ekle. Bu blok şu şekilde olmalı:
{"title": "...", "client": "...", "value": <sayı, USD>, "sections": [{"title": "...", "body": "..."}], "lineItems": [{"name": "...", "qty": <sayı>, "unit": <sayı, USD>}], "contractText": "..." (varsa revize sözleşme, yoksa boş bırak)}
- Bu json bloğunu SADECE teklif gerçekten tamamlandığında ekle; hâlâ soru soruyorsan ekleme.

ŞİRKET EKİBİ: ${teamBlock || "(henüz eklenmedi)"}

DOKÜMAN KÜTÜPHANESİ:
${docsBlock || "(henüz doküman eklenmedi)"}

GERÇEK PAKETLERİMİZ:
${pricingBlock}${websiteContext}`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

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
