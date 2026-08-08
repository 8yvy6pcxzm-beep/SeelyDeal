import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";
import appConfig, { aiOveragePack } from "@/app.config";
import { safeFetchWebsiteText } from "@/lib/safe-fetch-website";
import { templates } from "@/lib/demo/data";
import type { createServiceClient as CreateServiceClient } from "@/lib/supabase/server";

// AI drafting (company context + template docs + an optional attachment) routinely
// runs past the platform's default serverless timeout; give it real headroom so the
// request errors cleanly instead of hanging until the client times out on its own.
export const maxDuration = 120;

const MODEL = "claude-sonnet-5";

type ChatMessage = { role: "user" | "assistant"; content: string };
type Attachment = { name: string; mediaType: string; base64: string };

/** Normalized shape both demo templates (lib/demo/data.ts) and DB-saved custom
 *  templates (the `templates` table) resolve to, so the rest of this file doesn't
 *  need to care which source a template came from. */
type ResolvedTemplate = {
  name: string;
  introText?: string;
  aboutText?: string;
  sections: { title: string; body: string }[];
  lineItems: { name: string; qty: number; unit: number }[];
  contractText?: string;
  theme?: { primaryColor: string; accentColor: string; font?: string };
  nickname?: string;
};

/** Finds the named ("Leo" etc.) demo template a chat is asking for, if any. Nicknames
 *  only exist on kapsamlı-variant templates. When the same nickname exists in more than
 *  one sector (e.g. "leo" in both İnşaat and Genel), prefer the one whose sector name
 *  also appears in the chat, falling back to the sector-neutral "Genel" one. */
function matchNamedTemplate(chatText: string): ResolvedTemplate | undefined {
  const hits = templates.filter((t) => t.nickname && new RegExp(`\\b${t.nickname}\\b`, "i").test(chatText));
  const picked =
    hits.length <= 1
      ? hits[0]
      : hits.find((t) => chatText.includes(t.category.tr.toLowerCase())) ??
        hits.find((t) => t.category.tr === "Genel") ??
        hits[0];
  return picked ? normalizeDemoTemplate(picked) : undefined;
}

function normalizeDemoTemplate(t: (typeof templates)[number]): ResolvedTemplate {
  return {
    name: t.name.tr,
    introText: t.introText?.tr,
    aboutText: t.aboutText?.tr,
    sections: t.sections.map((s) => ({ title: s.title.tr, body: s.body.tr })),
    lineItems: (t.lineItems ?? []).map((li) => ({ name: li.name.tr, qty: li.qty, unit: li.unit })),
    contractText: t.contractText?.tr,
    theme: t.theme,
    nickname: t.nickname,
  };
}

/** Resolves a template by id from either the built-in demo set or the company's own
 *  saved (DB) templates — "Bu şablonla yaz" sends a bare id, so this has to work for both. */
async function resolveTemplateById(
  id: string,
  companyId: string,
  service: ReturnType<typeof CreateServiceClient>,
): Promise<ResolvedTemplate | undefined> {
  const demo = templates.find((t) => t.id === id);
  if (demo) return normalizeDemoTemplate(demo);

  const { data: row } = await service
    .from("templates")
    .select("name, sections, line_items, contract_text, intro_text, about_text")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!row) return undefined;

  return {
    name: row.name,
    introText: row.intro_text ?? undefined,
    aboutText: row.about_text ?? undefined,
    sections: (row.sections ?? []) as { title: string; body: string }[],
    lineItems: (row.line_items ?? []) as { name: string; qty: number; unit: number }[],
    contractText: row.contract_text ?? undefined,
  };
}

export async function POST(req: Request) {
  const { messages, websiteUrl, attachment, currentDraft, templateId } = (await req.json()) as {
    messages: ChatMessage[];
    websiteUrl?: string;
    attachment?: Attachment;
    /** The draft already sitting in the preview (e.g. loaded from a template, or an
     *  existing proposal being edited) — without this the model has no idea what a
     *  bare instruction like "işçilik x2 olsun" refers to. */
    currentDraft?: unknown;
    /** Set by "Bu şablonla yaz" on the very first message of a new draft — resolved
     *  server-side (demo or the company's own saved template) instead of relying on
     *  the client to know/send the template's full content. */
    templateId?: string;
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

  // Which system/custom template (if any) this draft is based on: an explicit id from
  // "Bu şablonla yaz" takes priority; otherwise fall back to a nickname ("Leo") mentioned
  // in free-form chat. Only resolved on the first message of a new draft (no currentDraft yet) —
  // once a real draft exists, edits go through DÜZENLEME MODU below instead.
  const fullChatText = messages.map((m) => m.content).join("\n").toLowerCase();
  const resolved: ResolvedTemplate | undefined = currentDraft
    ? undefined
    : templateId
      ? await resolveTemplateById(templateId, profile.company_id, service)
      : matchNamedTemplate(fullChatText);
  const resolvedBlock = resolved
    ? `"${resolved.name}"${resolved.nickname ? ` (kod adı "${resolved.nickname}")` : ""}:
Ön Yazı: ${resolved.introText}
Hakkımızda: ${resolved.aboutText}
${resolved.sections.map((s) => `${s.title}: ${s.body}`).join("\n")}
Örnek kalemler: ${resolved.lineItems.map((li) => li.name).join(", ")}
Sözleşme: ${resolved.contractText}`
    : "";

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
      ? `\n- Şirketin henüz ${!company?.logo_url && !company?.primary_color ? "logosu ve marka rengi" : !company?.logo_url ? "logosu" : "marka rengi"} ayarlanmamış. Sohbetin bir noktasında (ilk mesajlarda, doğal bir yerde) samimi bir şekilde sor: "Bu arada şirketinizin ${!company?.logo_url && !company?.primary_color ? "logosunu ve marka rengini" : !company?.logo_url ? "logosunu" : "marka rengini"} de alabilir miyim? Logo resmini buraya yapıştırman ya da hex renk kodunu (örn. #5B3DF6) yazman yeterli, direkt kaydedeceğim." Bunu SADECE BİR KEZ sor, ısrar etme.\n- MARKA KAYDI: Kullanıcı bir hex renk kodu yazarsa (örn. "#5B3DF6" veya "marka rengimiz mor, 5b3df6") ya da bir resim ekleyip bunun logo olduğunu belirtirse (ya da bağlamdan logo olduğu açıksa — ör. "logomuz bu", "işte logo"), cevabının SONUNA (json bloğundan sonra, varsa) ayrı bir \`\`\`brand ... \`\`\` bloğu ekle: {"setLogo": true/false, "primaryColor": "#RRGGBB" veya null}. Resim logoysa \`setLogo: true\` yap VE resimdeki baskın/marka rengini (arka plan beyaz/gri/siyahsa onu değil, logonun kendi rengini) dikkatlice tahmin edip \`primaryColor\`'a hex olarak yaz. Sadece renk koduysa \`setLogo: false, primaryColor: "#..."\`. Bu durumların dışında (kullanıcı logo/renk belirtmediyse) bu bloğu HİÇ ekleme. Cevap metninde ne kaydettiğini kısaca teyit et (örn. "Logonu ve marka rengini (#5B3DF6) kaydettim.").`
      : ""
  }
- TALİMAT KAYDI: Kullanıcı sana kalıcı bir kural/tercih bildirirse — "bundan sonra hep böyle yap", "her zaman", "bunu hatırla", "bir daha sorma, direkt X yap" gibi bir ifadeyle, gelecekteki teklifler için de geçerli olacak bir talimat verirse (örn. "opsiyonel kalemleri hep işaretsiz bırak", "ödeme linkini hiç sorma, ben eklerim") — cevabının SONUNA (varsa json/brand bloklarından sonra) ayrı bir \`\`\`instruction ... \`\`\` bloğu ekle: {"text": "kısa, net, tekrar kullanılabilir talimat cümlesi (emir kipiyle, örn. \\"Opsiyonel kalemleri varsayılan olarak işaretsiz bırak.\\")"}. Bu SADECE bu teklife özel değil, GELECEKTEKİ TÜM tekliflere uygulanacak kalıcı bir kural olduğunda ekle — tek seferlik bir istek ("bu teklifte X yap") için ekleme. Cevap metninde kısaca teyit et (örn. "Tamam, bunu bundan sonraki tüm tekliflerde hatırlayacağım.").
- Kullanıcı bir dosya (PDF, resim, ekran görüntüsü) eklerse, içeriğini oku ve teklif için gereken bilgileri (marka, fiyatlandırma, kapsam, müşteri bilgisi vb.) oradan çıkar — tekrar sorma.
${isLite ? "" : `- Kullanıcı "standart sözleşmemi/teklif formatımı kullan, şunu revize et" derse, aşağıdaki DOKÜMAN KÜTÜPHANESİ'nden ilgili dokümanı bul, verdiği talimatlara göre revize ederek kullan.\n`}- Fiyatlandırmada, aksi istenmedikçe aşağıdaki GERÇEK PAKETLERİMİZİ kullan.
- ÇOK ÖNEMLİ — TEK PAKET VARSAYILANI: Kullanıcı SeelyDeal'ı (bu ürünün kendisini) bir müşteriye satan bir teklif hazırlatıyorsa, VARSAYILAN OLARAK sadece TEK bir paket (müşterinin ihtiyacına en uygun olanı, belirsizse Pro) öner — o paketin fiyatını normal bir \`lineItem\` olarak yaz, \`billingOptions\` dizisini BOŞ bırak. \`billingOptions\`u (birden fazla, birbirini dışlayan seçenek — ki bu her seçenek için ayrı bir ödeme linki kutusu doğurur) SADECE kullanıcı açıkça "müşteri birden fazla paket arasından seçsin", "aylık ve yıllık ikisini de sunayım", "farklı seçenekler göster" gibi bir şey istediğinde kullan. "Kapsamlı olsun", "tüm bölümler dahil olsun" gibi genel istekler bunu TETİKLEMEZ — bunlar sadece bölüm/içerik zenginliğiyle ilgilidir, paket sayısıyla değil.
- ÇOK ÖNEMLİ — OKUNAKLILIK: \`sections\` dizisindeki her bölümün \`body\`'si UZUN PARAGRAF OLMASIN — her bölüm başlığının altına, o bölümü özetleyen TEK bir çarpıcı cümle yaz (en fazla ~20 kelime, gerekirse virgülle iki-üç madde birleştir). Örnek: "Keşif, marka sistemi, 8 sayfalık web sitesi ve devir." veya "Sabit ücret + opsiyonel bakım paketi." Detay gerekiyorsa ikinci cümleye değil, ayrı bir alt madde/kalem olarak lineItems'a taşı. \`introText\` ve \`aboutText\` bu kurala tabi değil, onlar kısa paragraf olabilir.
- Kullanıcı bir kalemi "opsiyonel" veya "ek hizmet" olarak belirtirse, o kalemi \`optional: true\` yap (müşteri bunu teklifi görüntülerken açıp kapatabilir). \`included\` alanı, opsiyonel kalemin varsayılan olarak işaretli gelip gelmeyeceğini belirtir (belirtilmediyse false).
- Kullanıcı "aylık veya yıllık" gibi müşterinin ikisinden birini seçeceği farklı fiyatlı ödeme sıklığı/paket seçenekleri isterse, bunları \`billingOptions\` dizisine yaz (her biri ayrı fiyat, müşteri teklifi imzalamadan önce birini seçer). Bu, tekil kalemlerden farklıdır — kalemler teklife toplam olarak eklenir/çıkarılır, billingOptions ise birbirini DIŞLAYAN seçeneklerdir (biri seçilir, diğerleri değil).
- Her \`billingOption\`a AYRI bir ödeme linki eklenebilir (müşteri o seçeneği seçip imzalarsa o linke yönlendirilir) — bunu SEN doldurmazsın, kullanıcı teklif önizlemesinde her seçeneğin altındaki link kutusuna kendisi yapıştırır. Kullanıcı "iki farklı ödeme sıklığı için iki ayrı ödeme linki ekleyebilir miyim" gibi bir şey sorarsa: EVET diye net cevap ver ve "teklif önizlemesinde her ödeme seçeneğinin altında kendi link kutusu var, oraya ayrı ayrı yapıştırabilirsin" diye açıkla.
- ÇOK ÖNEMLİ — SESSİZ SÜRPRİZ BIRAKMA: Kullanıcı "hiç soru sorma, kendin hallet" gibi bir şey söylese bile, \`billingOptions\` oluşturduğunda cevap metninde MUTLAKA açıkça belirt ki her seçenek için ayrı bir ödeme linkini kendisinin önizlemede elle ekleyeceği — bu, gerçek ödeme linklerine (Ruul/Stripe/iyzico) sistemde erişimin olmadığı için senin dolduramayacağın TEK adım. Örnek cümle: "N. paket için ayrı fiyat ekledim; ödeme linklerini önizlemede kendin yapıştırman gerekiyor, çünkü gerçek ödeme linklerine erişimim yok." Bunu sessizce boş kutulara bırakma, baştan söyle.
- Kullanıcı ödeme linki/IBAN eklemek istemediğini belirtirse (örn. "ödeme linki eklemiyecem", "eklemeyeceğim", "yok", "gerek yok"), bunu sorun etmeden onayla, ısrar etme veya tekrar sorma — teklif önizlemesindeki ödeme yöntemi alanı zaten opsiyoneldir, boş bırakılabilir.
- ÇOK ÖNEMLİ — TEKRARDAN KAÇIN: Teklif zaten tamamlanmış ve önizlemede kullanıcının önündeyse, kullanıcının mesajı teklifte GERÇEK bir değişiklik gerektirmiyorsa (örn. sadece bir alanı boş bırakmayı onaylıyor, teşekkür ediyor, veya konuyla ilgisiz kısa bir şey yazıyorsa) \`\`\`json\`\`\` bloğunu TEKRAR EKLEME ve teklifi "İşte teklif"/"Kapsamlı teklif hazırladım" gibi baştan tanıtan bir cümleyle yeniden özetleme — sadece TEK KISA cümleyle onayla (örn. "Tamam, ödeme linkini boş bıraktım.") ve sohbeti orada bırak. json bloğunu sadece teklifte gerçekten içerik/fiyat/bölüm değişikliği olduğunda tekrar gönder.
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
{"title": "...", "client": "...", "value": <sayı, USD>, "introText": "...", "aboutText": "...", "clientContact": {"company": "...", "contactName": "...", "title": "...", "address": "...", "phone": "...", "email": "...", "website": "..."}, "sections": [{"title": "...", "body": "..."${isCustom ? `, "condition": {"lineItem": "...", "billingKey": "..."} (opsiyonel, SADECE biri doldurulur, sadece kullanıcı koşullu içerik istediyse ekle)` : ""}}], "lineItems": [{"name": "...", "qty": <sayı>, "unit": <sayı, USD>, "optional": <true/false, opsiyonel>, "included": <true/false, opsiyonel>}], "billingOptions": [{"key": "...", "label": {"tr": "...", "en": "..."}, "price": <sayı, USD>}] (opsiyonel, sadece birden fazla ödeme sıklığı seçeneği varsa doldur, yoksa boş dizi bırak), "nextSteps": [{"title": "...", "body": "..."}], "validDays": <sayı>, "contractText": "..." (varsa revize sözleşme, yoksa boş bırak), "confirmed": <true/false>}
- Bu json bloğunu SADECE teklif gerçekten tamamlandığında ekle; hâlâ soru soruyorsan ekleme.
- ÇOK ÖNEMLİ — SON ONAY VE OTOMATİK KAYIT: Teklif ilk kez tamamlandığında (henüz kullanıcı onaylamadıysa), json bloğunu döndürürken cevap metninde TEK BİR kısa onay sorusu sor: "Bu haliyle onaylıyor musun? Onaylarsan hemen teklife ekliyorum." — \`confirmed\` alanını bu ilk turda \`false\` yap. Kullanıcı buna "evet", "onaylıyorum", "tamam", "bu şekilde tamam", "olsun" gibi net bir onayla cevap verirse (yeni bir değişiklik istemiyorsa), aynı teklifi (değişiklik yapmadan) json bloğuyla TEKRAR döndür ama bu sefer \`confirmed: true\` yap ve cevap metninde SADECE kısa bir teyit cümlesi kullan (örn. "Harika, kaydediyorum."), tekrar soru sorma. \`confirmed: true\` gönderdiğinde uygulama teklifi OTOMATİK olarak kaydeder, kullanıcının ayrıca bir butona basmasına gerek kalmaz. Kullanıcı zaten "başka soru sorma" dediyse veya teklifi tarif ederken "bu şekilde tamamdır/kaydet/onaylıyorum" gibi kendisi zaten net bir onay vermişse, ayrı bir onay sorusu sormadan DOĞRUDAN \`confirmed: true\` ile kaydet — gereksiz yere iki kez sorma.

HAZIRLAYAN (bizim şirketimiz): ${companyBlock}

KULLANICI TALİMATLARI (şirketin kendi eklediği kalıcı notlar — HER ZAMAN uygula, kullanıcı sohbette tekrar yazmasa bile geçerlidir): ${company?.ai_instructions?.trim() || "(yok)"}

ŞİRKET EKİBİ: ${teamBlock || "(henüz eklenmedi)"}

${
    currentDraft
      ? `ÖNEMLİ — DÜZENLEME MODU: Kullanıcının önünde zaten hazır bir teklif taslağı var (bir şablondan yazılmaya başlandı ya da daha önce üzerinde konuşuldu). Kullanıcının mesajı büyük ihtimalle bu taslak üzerinde KÜÇÜK, HEDEFLİ bir değişiklik istiyor (ör. "işçilik x2 olsun", "fiyatı 50000 yap", "müşteri adını değiştir"). AŞAĞIDAKİ MEVCUT TASLAK'ı baz al, İSTENEN DEĞİŞİKLİĞİ uygula, TALEP EDİLMEYEN hiçbir alanı değiştirme — metinleri yeniden yazma, kalemleri silme/ekleme, sırasını değiştirme, sadece istenen kısmı güncelle. "x2 olsun" gibi bir istek varsa ilgili \`lineItem\`in \`qty\` ya da \`unit\`inden hangisi anlama daha uygunsa onu 2 ile çarp (ör. "işçilik x2 olsun" → işçilik kaleminin toplamı ikiye katlanacak şekilde \`qty\` veya \`unit\`i güncelle). Cevabının sonundaki json bloğu bu taslağın TAMAMINI (değişmeyen alanlar dahil) güncel haliyle içermeli.\nMEVCUT TASLAK:\n${JSON.stringify(currentDraft)}\n\n`
      : ""
  }${
    isLite
      ? ""
      : `DOKÜMAN KÜTÜPHANESİ:
${docsBlock || "(henüz doküman eklenmedi)"}

`
  }${
    currentDraft
      ? ""
      : resolved
        ? defaultTemplate
          ? `ÖZEL ŞABLON — "${resolved.name}"${resolved.nickname ? ` (kod adı "${resolved.nickname}")` : ""}: kullanıcı bu teklif için bu şablonu seçti. Şirketin kendi standart teklif formatı da mevcut ("${defaultTemplate.title}", DOKÜMAN KÜTÜPHANESİ'nde) — ÜSLUP, MADDE İÇERİĞİ ve ŞARTLAR için ÖNCELİKLE o dokümanı kullan; "${resolved.name}" şablonundan ise SADECE bölüm sırasını/başlıklarını${resolved.theme ? " ve görsel temasını (otomatik uygulanacak)" : ""} al — ikisini harmanla. Kullanıcı henüz müşteri/proje bilgisi vermediyse, json döndürmeden önce doğal bir sohbet diliyle eksikleri sor.\n\n`
          : `ÖZEL ŞABLON — "${resolved.name}"${resolved.nickname ? ` (kod adı "${resolved.nickname}")` : ""}: kullanıcı bu teklif için bu şablonu seçti. VARSAYILAN TEKLİF ŞABLONU'nu YOK SAY, bunun yerine AŞAĞIDAKİ yapıyı ve bölüm başlıklarını takip et (metinleri kullanıcının brief'ine göre uyarla, sadece kopyalama; kullanıcı henüz müşteri/proje bilgisi vermediyse json döndürmeden önce doğal bir sohbet diliyle eksikleri sor):\n${resolvedBlock}\n${resolved.theme ? "Renk teması ve font otomatik uygulanacak, bunu ayrıca söylemene gerek yok.\n" : ""}\n`
        : `VARSAYILAN TEKLİF ŞABLONU:\n${defaultTemplate ? `"${defaultTemplate.title}":\n${defaultTemplate.content}` : builtInComprehensiveTemplate}\n\n`
  }GERÇEK PAKETLERİMİZ:
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
  // Stamp the theme ourselves rather than trusting the model to remember/emit it —
  // deterministic, so a given nickname always gets the same look. Templates without
  // a theme (e.g. "Genel Leo") leave themeJson unset — the proposal keeps the company's own color.
  if (draft && resolved?.theme) {
    draft.themeJson = resolved.theme;
  }

  // Optional ```brand``` block — logo/color the model detected in this turn (see MARKA KAYDI rule above).
  const brandMatch = replyText.match(/```brand\s*([\s\S]*?)```/);
  let brand: { setLogo?: boolean; primaryColor?: string | null } | null = null;
  if (brandMatch) {
    try {
      brand = JSON.parse(brandMatch[1]);
    } catch {
      brand = null;
    }
  }

  // Optional ```instruction``` block — a standing preference the user gave mid-chat (see TALİMAT KAYDI rule above).
  const instructionMatch = replyText.match(/```instruction\s*([\s\S]*?)```/);
  let instruction: string | null = null;
  if (instructionMatch) {
    try {
      const parsed = JSON.parse(instructionMatch[1]) as { text?: string };
      instruction = parsed.text?.trim() || null;
    } catch {
      instruction = null;
    }
  }

  // The draft quota (customer-facing) only counts a produced proposal; the message
  // count (cost backstop) always increments, since every call is a real API charge.
  await service.from("ai_usage").upsert(
    { company_id: profile.company_id, month, count: draft ? used + 1 : used, message_count: messagesUsed + 1 },
    { onConflict: "company_id,month" },
  );

  const reply = replyText
    .replace(/```json[\s\S]*?```/, "")
    .replace(/```brand[\s\S]*?```/, "")
    .replace(/```instruction[\s\S]*?```/, "")
    .trim();

  return NextResponse.json({ reply, draft, brand, instruction, remaining: limit - (draft ? used + 1 : used) });
}
