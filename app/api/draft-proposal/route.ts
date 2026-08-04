import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";
import appConfig, { aiOveragePack } from "@/app.config";
import { safeFetchWebsiteText } from "@/lib/safe-fetch-website";

// AI drafting (company context + template docs + an optional attachment) routinely
// runs past the platform's default serverless timeout; give it real headroom so the
// request errors cleanly instead of hanging until the client times out on its own.
export const maxDuration = 120;

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

  // Enforce the plan's monthly AI draft limit (customer-facing) and a much more
  // generous message-count ceiling (cost backstop — chatting is "free" against the
  // draft quota, but still costs real Anthropic API calls, so it can't be unlimited).
  const month = new Date().toISOString().slice(0, 7);
  const { data: usage } = await service
    .from("ai_usage")
    .select("count, message_count")
    .eq("company_id", profile.company_id)
    .eq("month", month)
    .maybeSingle();

  const limit: number = company?.ai_monthly_limit ?? 10;
  const used = usage?.count ?? 0;
  const messagesUsed = usage?.message_count ?? 0;
  const MESSAGE_LIMIT_MULTIPLIER = (company?.plan ?? "lite") === "lite" ? 15 : 18;
  const messageLimit = limit * MESSAGE_LIMIT_MULTIPLIER;

  const overagePack = aiOveragePack[(company?.plan as "lite" | "pro" | "custom") ?? "lite"];

  if (used >= limit) {
    return NextResponse.json(
      {
        error: `Bu ayki AI teklif hakkın (${limit}) doldu.`,
        overageLink: company?.overage_link ?? null,
        overagePrice: overagePack.price,
        overageDrafts: overagePack.extraDrafts,
      },
      { status: 429 },
    );
  }
  if (messagesUsed >= messageLimit) {
    return NextResponse.json(
      { error: "Bu ay çok fazla AI mesajı gönderildi. Lütfen bizimle iletişime geç." },
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

  // Lite (companies.plan === "lite") writes from the brief alone — no document library, no template following.
  const isLite = (company?.plan ?? "lite") === "lite";
  const isCustom = (company?.plan ?? "lite") === "custom";

  // AI Prefill (Custom only): if the chat mentions an existing client by name, pull their most recent proposal as context.
  let prefillBlock = "";
  if (isCustom) {
    const chatText = messages.map((m) => m.content).join("\n").toLowerCase();
    const { data: clients } = await service.from("clients").select("id, name").eq("company_id", profile.company_id);
    const matchedClient = (clients ?? []).find((c: { id: string; name: string }) => c.name && chatText.includes(c.name.toLowerCase()));

    if (matchedClient) {
      const { data: lastProposal } = await service
        .from("proposals")
        .select("title, value, line_items, sections, client_contact, contract_text, billing_options")
        .eq("client_id", matchedClient.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastProposal) {
        prefillBlock = `\n\nGERİ DÖNEN MÜŞTERİ (AI Prefill): "${matchedClient.name}" için önceki bir teklif kaydı bulundu:\n${JSON.stringify(lastProposal)}\nBu müşteri için yeni teklif hazırlıyorsan, kullanıcı aksini belirtmedikçe bu önceki bilgileri (fiyat, kapsam, iletişim bilgisi) varsayılan olarak kullan — tekrar sorma. Kısaca "X müşterisi için önceki teklifini hatırlıyorum (${lastProposal.title}), aynısını mı kullanayım yoksa bir şey mi değişti?" diye sor.`;
      }
    }
  }

  type Doc = { type: string; title: string; content: string; is_default_template: boolean };
  const docsBlock = isLite
    ? ""
    : (docs ?? []).map((d: Doc) => `- [${d.type}] "${d.title}":\n${d.content}`).join("\n\n");

  const defaultTemplate: Doc | undefined = isLite
    ? undefined
    : ((docs ?? []).find((d: Doc) => d.type === "proposal_template" && d.is_default_template) ??
      (docs ?? []).find((d: Doc) => d.type === "proposal_template"));

  const pricingBlock = appConfig.marketing.pricing
    .map((p) => `${p.name}: ${p.price}${p.period ? p.period.tr : ""} — ${p.features.map((f) => f.label.tr).join(", ")}`)
    .join("\n");

  const teamBlock = (team ?? [])
    .map((m: { name: string; title: string | null }) => `${m.name}${m.title ? ` (${m.title})` : ""}`)
    .join(", ");

  const companyBlock = `${company?.name ?? ""}${company?.email ? ` · ${company.email}` : ""} · ${appConfig.domain}`;

  // Built-in comprehensive template — used whenever no company-uploaded default template exists
  // (all plans, including Lite, which has no document library). Mirrors a full consulting-style
  // proposal: cover info, about us, our team, scope, methodology, pricing, contract terms, next steps.
  const builtInComprehensiveTemplate = `"Standart Kapsamlı Teklif" (yerleşik varsayılan):
1. Ön Yazı — "Sayın [muhatap adı]," ile başlayan, görüşmeyi hatırlatan kısa bir açılış (introText).
2. Hakkımızda — şirketin ne iş yaptığını anlatan kısa paragraf (aboutText).
3. Ekibimiz — projede yer alacak ekip üyeleri, unvanları ve kısa uzmanlık alanları (ayrı bir "Ekibimiz" section'ı olarak; ŞİRKET EKİBİ listesinden ve kullanıcının verdiği bilgilerden yararlan, isim/unvan uydurma).
4. Hizmet Kapsamı — sunulan hizmetlerin maddeler halinde net dökümü (bir veya birden fazla section).
5. Süreç / Nasıl Çalışıyoruz — işin hangi adımlarla ilerleyeceği (kickoff, uygulama, teslim gibi), kısa bir section.
6. Paket ve Ücret — lineItems (otomatik render edilir, ayrı section yazma).
7. Sözleşme Şartları — varsa revize edilmiş contractText, yoksa boş bırak.
8. Sonraki Adımlar — kabul sonrası süreç (nextSteps, 3-5 adım).`;

  const systemPrompt = `Sen ${company?.name ?? "bu işletme"} için çalışan bir teklif yazım asistanısın. Kullanıcı (işletme sahibi/çalışanı) seninle doğal, konuşma diliyle iletişim kurar ve senden müşterileri için teklif hazırlamanı ister.

KURALLAR:
- Türkçe konuş (kullanıcı İngilizce yazarsa İngilizce cevap ver).
- Teklif hazırlamak için gerekli bilgiler eksikse (müşteri adı, sunulacak hizmet, fiyatlandırma yaklaşımı) TEK TEK, doğal bir sohbet diliyle sor. Kullanıcı "nelere ihtiyacın var" derse hepsini liste halinde sun.
- Müşterinin web sitesini ASLA kendin tahmin etme veya arama; sadece kullanıcı paylaşırsa kullan. Paylaşmadıysa ve faydalı olacaksa nazikçe sor ("müşterinin web sitesini paylaşır mısın?").${
    !company?.logo_url || !company?.primary_color
      ? `\n- Şirketin henüz ${!company?.logo_url && !company?.primary_color ? "logosu ve marka rengi" : !company?.logo_url ? "logosu" : "marka rengi"} ayarlanmamış. Sohbetin bir noktasında (ilk mesajlarda, doğal bir yerde) samimi bir şekilde sor: "Bu arada şirketinizin ${!company?.logo_url && !company?.primary_color ? "logosunu ve marka rengini" : !company?.logo_url ? "logosunu" : "marka rengini"} de alabilir miyim? Şirket Profili sayfasından bir kere ayarlaman yeterli, o andan sonra tüm tekliflerinde otomatik görünür." Bunu SADECE BİR KEZ sor, ısrar etme; kullanıcı buraya bir logo dosyası veya renk kodu eklerse bunu doğrudan kaydedemeyeceğini, Şirket Profili'nden ayarlaması gerektiğini nazikçe hatırlat.`
      : ""
  }
- Kullanıcı bir dosya (PDF, resim, ekran görüntüsü) eklerse, içeriğini oku ve teklif için gereken bilgileri (marka, fiyatlandırma, kapsam, müşteri bilgisi vb.) oradan çıkar — tekrar sorma.
${isLite ? "" : `- Kullanıcı "standart sözleşmemi/teklif formatımı kullan, şunu revize et" derse, aşağıdaki DOKÜMAN KÜTÜPHANESİ'nden ilgili dokümanı bul, verdiği talimatlara göre revize ederek kullan.\n`}- Fiyatlandırmada, aksi istenmedikçe aşağıdaki GERÇEK PAKETLERİMİZİ kullan.
- ÇOK ÖNEMLİ — OKUNAKLILIK: \`sections\` dizisindeki her bölümün \`body\`'si UZUN PARAGRAF OLMASIN — her bölüm başlığının altına, o bölümü özetleyen TEK bir çarpıcı cümle yaz (en fazla ~20 kelime, gerekirse virgülle iki-üç madde birleştir). Örnek: "Keşif, marka sistemi, 8 sayfalık web sitesi ve devir." veya "Sabit ücret + opsiyonel bakım paketi." Detay gerekiyorsa ikinci cümleye değil, ayrı bir alt madde/kalem olarak lineItems'a taşı. \`introText\` ve \`aboutText\` bu kurala tabi değil, onlar kısa paragraf olabilir.
- Kullanıcı bir kalemi "opsiyonel" veya "ek hizmet" olarak belirtirse, o kalemi \`optional: true\` yap (müşteri bunu teklifi görüntülerken açıp kapatabilir). \`included\` alanı, opsiyonel kalemin varsayılan olarak işaretli gelip gelmeyeceğini belirtir (belirtilmediyse false).
- Kullanıcı "aylık veya yıllık" gibi müşterinin ikisinden birini seçeceği farklı fiyatlı ödeme sıklığı/paket seçenekleri isterse, bunları \`billingOptions\` dizisine yaz (her biri ayrı fiyat, müşteri teklifi imzalamadan önce birini seçer). Bu, tekil kalemlerden farklıdır — kalemler teklife toplam olarak eklenir/çıkarılır, billingOptions ise birbirini DIŞLAYAN seçeneklerdir (biri seçilir, diğerleri değil).
- Her \`billingOption\`a AYRI bir ödeme linki eklenebilir (müşteri o seçeneği seçip imzalarsa o linke yönlendirilir) — bunu SEN doldurmazsın, kullanıcı teklif önizlemesinde her seçeneğin altındaki link kutusuna kendisi yapıştırır. Kullanıcı "iki farklı ödeme sıklığı için iki ayrı ödeme linki ekleyebilir miyim" gibi bir şey sorarsa: EVET diye net cevap ver ve "teklif önizlemesinde her ödeme seçeneğinin altında kendi link kutusu var, oraya ayrı ayrı yapıştırabilirsin" diye açıkla.
- Kullanıcı ödeme linki/IBAN eklemek istemediğini belirtirse (örn. "ödeme linki eklemiyecem", "eklemeyeceğim", "yok", "gerek yok"), bunu sorun etmeden onayla, ısrar etme veya tekrar sorma — teklif önizlemesindeki ödeme yöntemi alanı zaten opsiyoneldir, boş bırakılabilir.
- ÇOK ÖNEMLİ: Hiçbir zaman CSV, PDF, HTML veya başka bir dosya "oluşturduğunu"/"kaydettiğini" söyleme — bu sistemde teklif dosya olarak üretilmez. Teklif sadece \`\`\`json\`\`\` bloğuyla döner, kullanıcı önizlemede "Teklife ekle" butonuna basınca uygulama içinde (veritabanında) kaydedilir. Kullanıcı "dosya nerede" diye sorarsa, teklifin uygulama içinde saklandığını ve dışa aktarma/indirme özelliği olmadığını net şekilde açıkla.
- ÇOK ÖNEMLİ: Kullanıcının sorduğu her soruya MUTLAKA yazıyla cevap ver — teklifi güncelleyip \`\`\`json\`\`\` bloğunu tekrar döndürürken bile önüne/arkasına en az 1-2 cümlelik bir açıklama koy. Asla sadece json bloğu dönüp yazı kısmını boş bırakma.${
    isCustom
      ? `\n- KOŞULLU İÇERİK: Kullanıcı "müşteri şunu seçerse teklife şu bölüm/şart eklensin" gibi bir talep belirtirse, o bölümü \`sections\` dizisinde ilgili section objesine \`condition\` alanı ekleyerek bir kaleme (\`lineItem\`) veya billing seçeneğine (\`billingKey\`) bağla — SADECE TEK bir kaleme/seçeneğe bağla, iç içe veya birden çok koşul kurma. Bu alan sadece kullanıcı gerçekten koşullu bir talep belirttiyse doldurulur, aksi halde hiç ekleme.`
      : ""
  }
- Teklifi SADE mi yoksa KAPSAMLI mı hazırlayacağına karar verirken şu sırayla ilerle:
  1. Kullanıcı açıkça "sade/basit hazırla" derse, DOĞRUDAN onu uygula (SADE) — bu her zaman en öncelikli kuraldır, başka hiçbir ipucuna bakma.${
    isLite
      ? ""
      : `\n  2. Kullanıcı DOKÜMAN KÜTÜPHANESİ'nden belirli bir "teklif formatı" adı verip onu istediyse, o şablonun yapısını birebir takip et (KAPSAMLI).\n  3. Kullanıcı özel bir şablon istemediyse, aşağıdaki VARSAYILAN TEKLİF ŞABLONU'nu (şirketin kendi yüklediği ya da yerleşik "Standart Kapsamlı Teklif") KULLANMAK ZORUNLUSUN — serbest/improvize nesir yazma, şablonun bölüm sırasını ve başlıklarını birebir takip et.`
  }
  4. Müşteri adı ve sunulacak hizmet netleştiği ama teklif tipi henüz belirtilmediyse — teklifi üretmeden ÖNCE tek bir soru olarak sor: "Standart kapsamlı bir teklif mi hazırlayayım (ön yazı, hakkımızda, ekip, hizmet kapsamı, süreç, sözleşme şartları, sonraki adımlar dahil), yoksa daha sade/hızlı bir teklif mi istersin?" Kullanıcı "kapsamlı/standart/detaylı" derse VARSAYILAN TEKLİF ŞABLONU'nu birebir takip et; "sade/hızlı" derse SADE hazırla. Kullanıcı bu soruyu atlayıp direkt "sade hazırla" ya da açıkça kapsamlı bir brief verdiyse, ayrıca sorma — kural 1'e göre davran.
  - \`introText\`: "Sayın [muhatap adı]," ile başlayan, görüşmeyi hatırlatan, 2-3 cümlelik resmi ama sıcak bir ön yazı.
  - \`aboutText\`: Şirketin ne iş yaptığını anlatan kısa bir "hakkımızda" paragrafı (şirket bilgilerinden ve dokümanlardan yararlan).
  - \`clientContact\`: Müşteri hakkında bildiğin bilgiler {"company": "...", "contactName": "...", "title": "...", "address": "...", "phone": "...", "email": "...", "website": "..."} — kullanıcı vermediği alanları boş bırak, UYDURMA.
  - \`nextSteps\`: Teklif kabul edildikten sonraki süreç, 3-5 adımlık {"title": "...", "body": "..."} dizisi (örn. Ödeme, Kurulum, Eğitim, Kullanıma başlama).
  - \`validDays\`: Teklifin kaç gün geçerli olduğu (belirtilmediyse 15).
- Yeterli bilgi toplandığında, cevabının SONUNA \`\`\`json ... \`\`\` bloğu ekle. Bu blok şu şekilde olmalı:
{"title": "...", "client": "...", "value": <sayı, USD>, "introText": "...", "aboutText": "...", "clientContact": {"company": "...", "contactName": "...", "title": "...", "address": "...", "phone": "...", "email": "...", "website": "..."}, "sections": [{"title": "...", "body": "..."${isCustom ? `, "condition": {"lineItem": "...", "billingKey": "..."} (opsiyonel, SADECE biri doldurulur, sadece kullanıcı koşullu içerik istediyse ekle)` : ""}}], "lineItems": [{"name": "...", "qty": <sayı>, "unit": <sayı, USD>, "optional": <true/false, opsiyonel>, "included": <true/false, opsiyonel>}], "billingOptions": [{"key": "...", "label": {"tr": "...", "en": "..."}, "price": <sayı, USD>}] (opsiyonel, sadece birden fazla ödeme sıklığı seçeneği varsa doldur, yoksa boş dizi bırak), "nextSteps": [{"title": "...", "body": "..."}], "validDays": <sayı>, "contractText": "..." (varsa revize sözleşme, yoksa boş bırak)}
- Bu json bloğunu SADECE teklif gerçekten tamamlandığında ekle; hâlâ soru soruyorsan ekleme.

HAZIRLAYAN (bizim şirketimiz): ${companyBlock}

ŞİRKET EKİBİ: ${teamBlock || "(henüz eklenmedi)"}

${
    isLite
      ? ""
      : `DOKÜMAN KÜTÜPHANESİ:
${docsBlock || "(henüz doküman eklenmedi)"}

`
  }VARSAYILAN TEKLİF ŞABLONU:
${defaultTemplate ? `"${defaultTemplate.title}":\n${defaultTemplate.content}` : builtInComprehensiveTemplate}

GERÇEK PAKETLERİMİZ:
${pricingBlock}${websiteContext}${prefillBlock}`;

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

  const jsonMatch = replyText.match(/```json\s*([\s\S]*?)```/);
  let draft = null;
  if (jsonMatch) {
    try {
      draft = JSON.parse(jsonMatch[1]);
    } catch {
      draft = null;
    }
  }

  // The draft quota (customer-facing) only counts a produced proposal; the message
  // count (cost backstop) always increments, since every call is a real API charge.
  await service.from("ai_usage").upsert(
    { company_id: profile.company_id, month, count: draft ? used + 1 : used, message_count: messagesUsed + 1 },
    { onConflict: "company_id,month" },
  );

  const reply = replyText.replace(/```json[\s\S]*?```/, "").trim();

  return NextResponse.json({ reply, draft, remaining: limit - (draft ? used + 1 : used) });
}
