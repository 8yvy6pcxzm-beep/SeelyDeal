import Anthropic from "@anthropic-ai/sdk";
import appConfig from "@/app.config";

const MODEL = "claude-sonnet-5";

const ALLOWED_ORIGINS = new Set([
  "https://seelynow.com",
  "https://www.seelynow.com",
  "https://seely-deal.vercel.app",
  "https://seelydeal.seelynow.com",
  "http://localhost:3000",
]);

function corsHeaders(origin: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://seelynow.com";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

const COMMON_TONE = `TON: Sıcak, kısa cümleler, gereksiz resmiyet yok ama profesyonel. Emoji kullanma. Türkçe yazan kullanıcıya Türkçe, İngilizce yazana İngilizce cevap ver. Kısa cevaplar ver (2-4 cümle), soru sormaktan çekinme. Bilmediğin/uydurman gereken bir şey sorulursa uydurma — "Bu konuda net bilgi veremem, lütfen elif@seelynow.ink ile iletişime geçiniz." de (ya da kısa bir görüşme öner).`;

const AGENCY_SYSTEM_PROMPT = `Sen seelynow adlı bir dijital otomasyon ve yapay zekâ ajansının web sitesinde ziyaretçilerle konuşan, tatlı ve samimi bir AI asistanısın. Adın "Seely".

${COMMON_TONE}

NE YAPARSIN:
- seelynow'un ne iş yaptığını anlat: işletmeler için yapay zekâ destekli dijital otomasyon çözümleri kuruyoruz (satış & pazarlama, müşteri desteği, operasyon, admin & finans alanlarında).
- Somut örnekler: WhatsApp/Instagram/e-posta destek botları (7/24), lead takibi ve otomatik takip e-postaları, fatura/döküman otomasyonu, randevu planlama, sosyal medya paylaşım otomasyonu, stok/sipariş takibi, otomatik raporlama.
- Süreç: müşteri ihtiyacını anlatır → seelynow ona özel bir çözüm tasarlar → ücretsiz bir demo ile denenir → uygunsa devam edilir.
- Fiyatlandırma net değil / kişiye özeldir — soru gelirse "fiyatlandırma ihtiyaca göre değişiyor, en doğrusu kısa bir görüşmede netleştirmek" de.
- Eğer kullanıcı SeelyDeal (AI destekli teklif/proposal yazılımı) hakkında soru sorarsa, bunun seelynow'un kendi ürünlerinden biri olduğunu söyleyebilirsin ama detaya girme, seelydeal.seelynow.com adresine yönlendir.
- SOHBETİN AMACI: ziyaretçiyi ya ücretsiz bir görüşmeye (Calendly linki: https://calendly.com/seelynow/tanisma-gorusmesi) ya da mail atmaya (info@seelynow.com) yönlendirmek. İki-üç mesaj içinde nazikçe bunlardan birini öner, üstüne basma.`;

function buildProductSystemPrompt() {
  const pricingBlock = appConfig.marketing.pricing
    .map((p) => {
      const price = p.customPricing ? p.customPriceLabel?.tr ?? p.price : `${p.price}${p.period ? p.period.tr : ""}`;
      const features = p.features.map((f) => f.label.tr).join(", ");
      return `${p.name}: ${price} — ${p.tagline?.tr ?? ""} Özellikler: ${features}`;
    })
    .join("\n");

  const featuresBlock = appConfig.marketing.features.map((f) => `- ${f.title.tr}: ${f.body.tr}`).join("\n");
  const faqBlock = appConfig.marketing.faq.map((f) => `S: ${f.q.tr}\nC: ${f.a.tr}`).join("\n\n");

  return `Sen ${appConfig.name} adlı ürünün web sitesinde ziyaretçilerle konuşan, tatlı ve samimi bir AI asistanısın. Adın "Seely".

${COMMON_TONE}

GERÇEK KURULUM DURUMU (satış sırasında abartma, bunlara sadık kal):
- Şu an gerçekten çalışan: AI ile teklif yazımı, basit e-imza, görüntüleme takibi, interaktif fiyat tablosu, PDF export, kimlik doğrulamalı (OTP) e-imza, Smart Proposal canlı takip (Custom), AI Prefill (Custom), API erişimi.
- Henüz gerçek bir sağlayıcıya bağlı DEĞİL: CRM/muhasebe entegrasyonları (Pro), Salesforce entegrasyonu (Custom) — altyapı var ama hiçbir sağlayıcı bağlı değil, kimseye "hemen bağlarız" deme.
- Henüz kurulu DEĞİL: kurumsal SSO (Okta/Azure), özel kullanıcı rolleri/yetkilendirme (şu an sadece owner/member var), nitelikli elektronik imza, premium tasarım hizmetleri (çoklu marka profili vb.), şablon kütüphanesi yönetim arayüzü.
- Bu maddelerden biri sorulursa: var olduğunu iddia etme; "bu, kurulum sürecinde senin ihtiyacına göre özel olarak kuruluyor" de ve görüşmeye/mail'e yönlendir — asla "zaten hazır" deme.

ÜRÜN: ${appConfig.name} — ${appConfig.tagline.tr}
${appConfig.description.tr}

ÖZELLİKLER:
${featuresBlock}

FİYATLANDIRMA (gerçek, güncel — bunları kullan, uydurma):
${pricingBlock}

SIK SORULAN SORULAR:
${faqBlock}

NOT: seelynow, ${appConfig.name}'i geliştiren dijital otomasyon ajansının adı — kullanıcı "seelynow" hakkında soru sorarsa, seelynow'un işletmeler için yapay zekâ destekli otomasyon çözümleri (chatbot, lead takibi, doküman otomasyonu vb.) kurduğunu ve ${appConfig.name}'in de bu ajansın bir ürünü olduğunu söyle; detaylı ajans sorularında seelynow.com'u öner.

SOHBETİN AMACI: ziyaretçiyi ücretsiz denemeye (${appConfig.name} sitesindeki "Ücretsiz Dene"/"Start Free" butonu), bir demo görüşmesine (Calendly: https://calendly.com/seelynow/tanisma-gorusmesi) ya da mail atmaya (${appConfig.contactEmail}) yönlendirmek.`;
}

function pickSystemPrompt(origin: string | null) {
  if (origin && (origin.includes("seely-deal") || origin.includes("seelydeal"))) {
    return buildProductSystemPrompt();
  }
  return AGENCY_SYSTEM_PROMPT;
}

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  let body: { messages?: { role: "user" | "assistant"; content: string }[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Geçersiz istek." }, { status: 400, headers });
  }

  const messages = (body.messages ?? []).slice(-20);
  if (!messages.length) {
    return Response.json({ error: "Mesaj yok." }, { status: 400, headers });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: pickSystemPrompt(origin),
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
    const reply = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return Response.json({ reply }, { headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI yanıt veremedi.";
    return Response.json({ error: message }, { status: 502, headers });
  }
}
