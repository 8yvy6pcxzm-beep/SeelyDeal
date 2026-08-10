import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";
import appConfig, { aiOveragePack } from "@/app.config";
import { safeFetchWebsiteText } from "@/lib/safe-fetch-website";
import { templates } from "@/lib/demo/data";
import { planAllows } from "@/lib/plan";
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

/** Finds the named demo template a chat is asking for, if any. Nicknames are opt-in
 *  per template. When the same nickname exists in more than one sector, prefer the
 *  one whose sector name also appears in the chat, falling back to "Genel". */
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
  const { messages, websiteUrl, attachments, currentDraft, templateId } = (await req.json()) as {
    messages: ChatMessage[];
    websiteUrl?: string;
    attachments?: Attachment[];
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

  // Defense in depth — the client already downscales images and caps the
  // combined size, but this route can be called directly, and a very large
  // combined payload risks running past the function's time limit.
  const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;
  const totalAttachmentBytes = (attachments ?? []).reduce((sum, a) => sum + a.base64.length * 0.75, 0);
  if (totalAttachmentBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
    return NextResponse.json({ error: "Dosyaların toplamı çok büyük — birini kaldırıp tekrar dene." }, { status: 413 });
  }

  const service = createServiceClient();

  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 });
  }

  const [{ data: company }, { data: team }, { data: docs }, { data: userDefault }, { data: recentOwnProposals }] = await Promise.all([
    service.from("companies").select("*").eq("id", profile.company_id).single(),
    service.from("team_members").select("name, title").eq("company_id", profile.company_id),
    service.from("company_documents").select("type, title, content, is_default_template").eq("company_id", profile.company_id),
    service.from("user_defaults").select("*").eq("profile_id", user.id).maybeSingle(),
    // Last 2 proposals THIS person drafted (not just anyone in the company) — used to
    // notice "keeps picking the same template+format" and offer to save it as default.
    service
      .from("proposals")
      .select("template_id, format")
      .eq("company_id", profile.company_id)
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(2),
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
  // "Bu şablonla yaz" takes priority; otherwise fall back to a template nickname mentioned
  // in free-form chat. Only resolved on the first message of a new draft (no currentDraft yet) —
  // once a real draft exists, edits go through DÜZENLEME MODU below instead.
  const fullChatText = messages.map((m) => m.content).join("\n").toLowerCase();
  // Templates are Pro+ (see app/(app)/templates/page.tsx) — Lite ignores any
  // templateId/nickname reference even if sent directly to this API.
  const resolved: ResolvedTemplate | undefined = !planAllows(company?.plan, "templates_create")
    ? undefined
    : currentDraft
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

  // A URL the user explicitly typed/pasted into the chat is just as much "the
  // customer shared it" as using the dedicated link field — only fetch it
  // when it's literally present in their own message, never guessed/searched.
  const URL_PATTERN = /\b(?:https?:\/\/)?(?:www\.)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+\.[a-z]{2,}(?:\/[^\s)]*)?\b/i;
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const mentionedUrl = !websiteUrl ? lastUserMessage?.content.match(URL_PATTERN)?.[0] : undefined;
  const effectiveWebsiteUrl = websiteUrl || (mentionedUrl ? (/^https?:\/\//i.test(mentionedUrl) ? mentionedUrl : `https://${mentionedUrl}`) : undefined);

  let websiteContext = "";
  if (effectiveWebsiteUrl) {
    const text = await safeFetchWebsiteText(effectiveWebsiteUrl);
    websiteContext = text
      ? `\n\nPaylaşılan web sitesinden (${effectiveWebsiteUrl}) çıkarılan metin:\n"""${text}"""\nBu metni İKİ amaç için kullan: (1) marka dili/tonu ve hizmetleri anlamak, (2) mümkünse buradan karşı tarafın (müşterinin) ŞİRKET UNVANINI ve ADRESİNİ çıkarıp \`clientContact.company\` ve \`clientContact.address\` alanlarına yerleştirmek — metinde unvan/adres net şekilde geçiyorsa doğrudan kullan, geçmiyorsa UYDURMA ve alanı boş bırak. Bu site kullanıcının KENDİ sitesiyse (müşterinin değil), bunun yerine sadece marka dili/tonu ve hizmetleri anlamak için kullan, clientContact alanlarına yazma.`
      : `\n\nNot: verilen web sitesi (${effectiveWebsiteUrl}) çekilemedi — kullanıcıya bilgiyi manuel anlatmasını iste.`;
  }

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
  const docsBlock = (docs ?? []).map((d: Doc) => `- [${d.type}] "${d.title}":\n${d.content}`).join("\n\n");

  const defaultTemplate: Doc | undefined =
    (docs ?? []).find((d: Doc) => d.type === "proposal_template" && d.is_default_template) ??
    (docs ?? []).find((d: Doc) => d.type === "proposal_template");

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

  // Onboarding (Adım 4.5c) lets a company pick which of the 8 standard sections
  // should be included by default in every future proposal — surface that choice
  // here so it's actually honored on every new draft, not just remembered.
  const SECTION_LABELS: Record<string, string> = {
    intro: "Ön Yazı",
    about: "Hakkımızda",
    team: "Ekibimiz",
    scope: "Hizmet Kapsamı",
    process: "Süreç/Nasıl Çalışıyoruz",
    pricing: "Paket ve Ücret",
    terms: "Sözleşme Şartları",
    next: "Sonraki Adımlar",
  };
  const defaultSections = company?.default_sections as Record<string, boolean> | null | undefined;
  const defaultSectionsBlock =
    !currentDraft && defaultSections
      ? `\nVARSAYILAN BÖLÜM TERCİHİ: Şirket, aksi açıkça istenmedikçe her yeni teklifte şu bölümleri kullanmak istiyor: ${Object.entries(
          defaultSections,
        )
          .filter(([, v]) => v)
          .map(([k]) => SECTION_LABELS[k] ?? k)
          .join(", ")}${
          Object.values(defaultSections).some((v) => !v)
            ? ` (şunları İSTEMİYOR: ${Object.entries(defaultSections)
                .filter(([, v]) => !v)
                .map(([k]) => SECTION_LABELS[k] ?? k)
                .join(", ")})`
            : ""
        }. Kullanıcı bu teklif için özel olarak farklı bölümler isterse (örn. "kapsamlı olsun" deyip hepsini isterse ya da belirli bölümler sayarsa) onun isteğini önceliklendir, aksi halde bu varsayılanı kullan.\n`
      : "";

  // Kişiye özel varsayılan (Faz 2): her kullanıcı (profil) için ayrı — bir şirkette
  // birden fazla kişi farklı şablon/format tercih edebilir. userDefault varsa
  // sessizce uygula (tekrar sorma); yoksa ve son 2 teklif de aynı şablon+formatı
  // kullandıysa, bunu varsayılan yapmayı TEKLİF ET.
  const lastTwo = (recentOwnProposals ?? []) as { template_id: string | null; format: string | null }[];
  const personalDefaultBlock = userDefault
    ? `\nKİŞİSEL VARSAYILAN (bu kullanıcı için kayıtlı — "${userDefault.label}"): şablon id: ${userDefault.template_id ?? "(yok)"}, çıktı formatı: ${userDefault.preferred_format ?? "(belirtilmemiş)"}. Kullanıcı bu teklif için AÇIKÇA farklı bir şey istemediği sürece (örn. "bu sefer farklı bir şablon kullan" derse), bu varsayılanı SESSİZCE uygula — şablon veya format hakkında TEKRAR SORMA, zaten biliyorsun. Kullanıcı "aksine bir ayarlama yapana kadar" demişti, yani sen değiştirmediği sürece hep bunu kullan.\n`
    : `\nKİŞİSEL VARSAYILAN: Bu kullanıcı için henüz kayıtlı bir varsayılan yok. Çıktı formatını (PDF mi, yoksa paylaşılabilir bir link/HTML sayfası mı) sohbette henüz belirtmediyse SOR (bir kez, kısaca: "Bu teklifi PDF olarak mı, yoksa paylaşılabilir bir link olarak mı hazırlayayım?"). ${
        lastTwo.length >= 1
          ? `Bu kullanıcının bir önceki teklifinde kullandığı şablon/format: şablon id ${lastTwo[0].template_id ?? "(yok)"}, format ${lastTwo[0].format ?? "(yok)"}. Eğer BU teklifte kullanıcı AYNI şablonu VE AYNI formatı seçtiyse, kullanıcı teklifi ONAYLAYIP KAYDETTİĞİ o TAM cevapta (json bloğuyla aynı cevapta), cevap metninin başına/sonuna şunu ekleyerek sor: "Fark ettim, art arda aynı şablon ve formatı kullanıyorsun — bunu senin için varsayılan yapayım mı? Aksine bir ayarlama yapana kadar tüm tekliflerini böyle hazırlarım." Bunu SADECE taslak onaylanıp kaydedilirken (confirmed:true olacağı turda) sor, daha önce değil. Kullanıcı bir sonraki mesajında "evet" derse, cevabının sonuna \`\`\`userDefault\`\`\` bloğu ekle: {"label": "[kullanıcının adı/hitap şekli] Varsayılanı", "templateId": "...", "preferredFormat": "pdf veya html"} — kullanıcının adını onboarding'de verdiği hitap şeklinden (ya da bilmiyorsan sor) al.`
          : "Bu kullanıcının daha önce kaydedilmiş bir teklifi yok, örüntü karşılaştırması yapılamaz — bu adımı atla."
      }\n`;
  const formatBlockRule = `\nÇIKTI FORMATI KAYDI: Bu teklif için çıktı formatı (PDF ya da link/HTML) netleştiği HER turda (sorulup cevaplandığında ya da kişisel varsayılandan sessizce alındığında), cevabının sonuna ayrı bir \`\`\`format\`\`\` bloğu ekle: {"value": "pdf"} veya {"value": "html"} — bu, uygulamanın teklifi kaydederken kullanması için gerekli, sadece bir kez değil, format netleştiği her turda tekrar ekle.\n`;

  // Stay in the onboarding script for the WHOLE flow, not just the first turn —
  // otherwise the model only ever sees the "say hi" instruction and never the
  // later steps (company intro, name confirm, AI instructions, completion
  // block), so onboarding_completed never flips true and the intro repeats
  // on every single open.
  const isOnboarding = !company?.onboarding_completed;

  const onboardingBlock = isOnboarding
    ? `\nİLK TANIŞMA AKIŞI (bu şirket onboarding'i henüz tamamlamadı, bunu ÖNCELİKLE uygula):
- Bu talimat bloğu, onboarding tamamlanana kadar HER turda sana veriliyor — konuşma geçmişine bak, hangi adımda kaldığını oradan anla ve SADECE bir sonraki adımı uygula. Zaten yapılmış bir adımı (örn. karşılamayı) TEKRAR yazma.
- Adım 1 (sohbetin ilk mesajı): kullanıcının mesajından TAMAMEN BAĞIMSIZ olarak şu tanıtımla başla (aynen bu ruhla, birebir kopyalamak zorunda değilsin ama anlamı ve sıcaklığı korunmalı): "Selam! Tanıştığımıza memnun oldum. Ben Seely, sadece sana yardım için buradayım. Benimle ilgili her şeyi buraya yazarak yönetebilirsin." Sonra YENİ bir paragrafta "5 dakikan varsa, beni nasıl kullanabileceğini kısaca anlatabilirim, ister misin?" diye sor (kullanıcı istemezse ısrar etme, direkt sıradaki adıma geç). Bu ilk mesajda henüz dosya yükleme isteğine GEÇME — o, kullanıcı bu soruya cevap verdikten SONRAKİ mesajında gelir.
- Adım 2 (kullanıcı adım 1'deki soruya cevap verdiğinde): "evet" derse (açıklama isterse), açıklamayı KISA tut (en fazla 3-4 madde) ve BU MESAJI SADECE açıklamaya ayır — mesajın sonuna bir müşteri/teklif sorusu EKLEME, "hangi müşteri için" gibi bir soru bu mesajda YASAK. Açıklama, nötr bir kapanışla bitsin (örn. "Hazır olduğunda devam edelim." veya hiç kapanış cümlesi olmadan). "Hayır/istemiyorum" derse bu adımı hiç yazma, direkt adım 3'e geç.
- Adım 3 (adım 2'den SONRAKİ, ayrı bir mesajda): şirketini tanımasını iste. Şirket profili için tam olarak NELERE ihtiyacın olduğunu AÇIKÇA say: şirket/marka adı, iletişim e-postası, slogan (varsa), logo/marka rengi, sunduğu hizmet(ler) ve fiyatlandırma yaklaşımı (sabit ücret mi, paket mi, saatlik mi). Bunun en hızlı yolunun, daha önce hazırladıkları bir örnek teklifi (PDF/Word/resim) YA DA sitelerinin bir ekran görüntüsünü paylaşmaları olduğunu söyle — TEK bir dosya bunların hepsini karşılayabilir. "bu bizim hazırladığımız bir teklif" veya "bu bizim sitemiz" diye bir dosya/ekran görüntüsü paylaşırlarsa, içeriğinden bu bilgileri SEN çıkarırsın. Ekran görüntüsü önermenin sebebi: bir site LİNKİ paylaşırlarsa senin görebileceğin sadece düz metin olur, marka renklerini/görsel kimliğini/logoyu bir linkten ÇIKARAMAZSIN — bunu kullanıcıya söyleme gerek yok ama kendi tercihini buna göre yap. Kullanıcı yine de bir site linki paylaşırsa: paylaşılan linkten çıkarılan metni (varsa, aşağıda "Paylaşılan web sitesinden..." notunda) hizmet/ton bilgisi için kullan, ama marka rengi/görsel kimlik/logo istiyorsan nazikçe sitenin bir ekran görüntüsünü de rica et. Bunu kendi paragrafında, kısa ve tek bir istek olarak yaz. Bu adımı ASLA açıklama mesajıyla veya müşteri/teklif sorusuyla birleştirme — sırasıyla ayrı mesajlar olmalı: (1) tanıtım+açıklama teklifi, (2) [istendiyse] açıklama, (3) şirket tanıma isteği + gereken bilgilerin listesi, (4) TEK BİR ONAY MESAJI (aşağıda anlatılıyor), (5) ancak onay alındıktan SONRA müşteri teklifine geçilir. Kullanıcı dosya/ekran görüntüsü yüklemek istemezse, aynı bilgileri birkaç kısa soruyla sohbetten topla (yine tek seferde hepsini üst üste sormadan, birer birer).
- ADIM 3'TEN 4'E GEÇME KOŞULU: adım 3'te istenen bilgilerin (şirket/marka adı, e-posta, slogan, logo/renk, hizmetler, fiyatlandırma yaklaşımı) HER BİRİ en az bir kez sorulmuş/istenmiş olmalı — kullanıcı cevabında bir kısmını atlarsa (örn. sadece kendi adını/unvanını söylerse), eksik kalanları AYRI bir mesajda, teker teker sor. Kullanıcı "bilmiyorum/boşver/şimdilik geç" derse ısrar etme, o alanı boş bırakıp devam et — ama en azından SORMADAN adım 4'e geçme.
- ADIM 4 — TEK KONSOLİDE ONAY (ÇOK ÖNEMLİ): Tüm bilgiler toplandıktan (veya mümkün olduğunca toplandıktan) SONRA, bunları TEK BİR mesajda özetleyip açıkça onay iste — örn. "Bu bilgileri varsayılan olarak şirket profiline ekliyorum, onaylıyor musun?" dedikten sonra kısa bir liste: "Şirket adı: ..., E-posta: ..., Slogan: ..., Marka rengi: ..., Hizmetler/fiyatlandırma: ...". Kullanıcı "evet/onaylıyorum/tamam" gibi net bir onay verene kadar \`\`\`brand\`\`\` bloğunu EKLEME — bu bilgiler kullanıcı açıkça onaylamadan KAYDEDİLMEZ. Kullanıcı onaylarsa, o turun cevabında (kısa bir teşekkür/teyit cümlesiyle) \`\`\`brand\`\`\` bloğuna toplanan TÜM alanları doldur: {"name": "...", "email": "...", "tagline": "...", "setLogo": ..., "primaryColor": ..., "servicesSummary": "..."} (sadece gerçekten bilgi varsa doldur, yoksa alanı hiç ekleme). \`servicesSummary\`, hizmetlerin ve fiyatlandırma yaklaşımının net, kısa bir özeti olsun (madde madde de olabilir, örn. "- Web sitesi tasarımı: $2000 sabit ücret\\n- Aylık bakım: $200/ay") — bu, Şirket Profili → Varsayılan İçerik'te "Hizmetler ve Fiyatlandırma" adlı bir doküman olarak kaydedilir ve BUNDAN SONRAKİ HER teklif taslağında otomatik kullanılır. ÇOK ÖNEMLİ: bu, kullanıcının KENDİ hizmet/fiyat bilgisidir — aşağıdaki GERÇEK PAKETLERİMİZ (SeelyDeal'ın kendi Lite/Pro/Custom fiyatları) listesini burada ASLA önerme veya varsayılan olarak sunma, o tamamen ayrı ve alakasız bir liste. Kullanıcı bazı alanları reddederse/düzeltirse, sadece düzeltilenle güncelleyip tekrar TEK bir onay iste.
- ADIM 4.5a — VARSAYILAN TEKLİF ŞABLONU (adım 4'ün onayından SONRA, ayrı bir mesajda, SADECE kullanıcı bu sohbette daha önce TAM bir örnek teklif paylaştıysa — "bu bizim hazırladığımız bir teklif", "bundan yapacağız" gibi bir şeyle birlikte gelen, gerçek bir teklifin tam içeriği; sadece kısa bir marka/site bilgisi DEĞİL): paylaşılan içeriği kullanarak "Bunu varsayılan teklif şablonun yapalım mı? Böylece bundan sonraki her teklif bu formatla, bu üslupla yazılır." diye sor. Kullanıcı örnek paylaşmadıysa bu adımı TAMAMEN ATLA, hiç sorma. Kullanıcı onaylarsa, cevabının sonundaki \`\`\`brand\`\`\` bloğuna \`"defaultTemplateContent"\` alanını ekle: paylaşılan örneğin düz metin içeriği (başlıklar/bölümler korunarak, gereksiz tekrar olmadan). Kullanıcı istemezse veya değişiklik isterse, onun dediğini uygula ya da bu adımı atla.
- ADIM 4.5b — LOGO (eksikse, ayrı bir mesajda): Şirketin logosu hâlâ verilmediyse ("aşağıda 'Şirketin henüz logosu...' notu görüyorsan"), burada BİR KEZ daha sor: "Logonu da alabilir miyim? Resmi buraya yapıştırman yeterli, direkt kaydederim." Kullanıcı geçerse ısrar etme, hemen sıradaki adıma geç. Zaten verilmişse bu adımı hiç yazma.
- ADIM 4.5c — VARSAYILAN BÖLÜMLER (ayrı bir mesajda): "Her yeni teklifte varsayılan olarak hangi bölümler yer alsın?" diye sorup şu 8 bölümü TEK TEK say: Ön Yazı, Hakkımızda, Ekibimiz, Hizmet Kapsamı, Süreç/Nasıl Çalışıyoruz, Paket ve Ücret, Sözleşme Şartları, Sonraki Adımlar. Bu soruyu sorarken MUTLAKA şu iki kısayolu da açıkça sun (aynen bu cümleyle bitir, kısaltma): "Hepsi olsun mu, yoksa sade (sadece Ön Yazı, Hizmet Kapsamı, Paket ve Ücret, Sonraki Adımlar) mi istersin?" — bu cümleyi es geçme, çünkü kullanıcı büyük ihtimalle "hepsi" veya "sade" gibi tek kelimeyle cevap verecek.
  KULLANICI CEVABI EŞLEŞTİRME (harfiyen uygula, aksi yönde YORUMLAMA):
  * "hepsi", "hepsi olsun", "tümü" → SEKİZİ DE true.
  * "sade", "sade olsun", "basit", "sade olsun yeter", "minimal" → SADECE şu 4'ü true: Ön Yazı (intro), Hizmet Kapsamı (scope), Paket ve Ücret (pricing), Sonraki Adımlar (next); DİĞER 4'Ü (Hakkımızda/about, Ekibimiz/team, Süreç/process, Sözleşme Şartları/terms) false. "Sade" kelimesini gördüğünde ASLA hepsini true yapma — bu kelimenin anlamı "az/çekirdek", "kapsamlı/hepsi" değil.
  * Kullanıcı belirli bölümler sayarsa (örn. "ekip ve süreç olmasın") sadece onları false, diğerlerini true yap.
  Cevabının sonuna \`\`\`brand\`\`\` bloğuna \`"defaultSections"\` alanını ekle: {"intro": true/false, "about": ..., "team": ..., "scope": ..., "process": ..., "pricing": ..., "terms": ..., "next": ...} — SEKİZ alanın HEPSİNİ doldur, hiçbirini atlama. Cevap metninde hangi bölümleri dahil ettiğini AÇIKÇA listele (örn. "Sade gidiyoruz: Ön Yazı, Hizmet Kapsamı, Paket ve Ücret, Sonraki Adımlar.") ki kullanıcı yanlış anlaşılma varsa hemen düzeltebilsin.
- Şirket adı netleştiği/onaylandığı an (adım 4'ün onayından hemen sonraki cevabında), "Şimdi kendimize geldik! Selam [şirket adı], ya da sana nasıl hitap etmemi istersin?" gibi bir karşılamayla geç — bunu hafif, nabız yoklar gibi sor, ISRARCI olma. Kullanıcı "farketmez", "bilmiyorum", "istemiyorum" gibi cevap verirse ya da soruyu geçerse hemen bırak, tekrar sorma; şirket adını (veya varsayılan bir hitabı) kullanmaya devam et.
- Son adımda, teklifleri onun için nasıl daha kişisel yazacağını sor — kalıcı AI talimatları toplamaya çalış (örn. ton, kaçınılacak ifadeler, hep uygulanacak kurallar — bunlar adım 4'te kaydedilen hizmet/fiyatlandırma özetine EK olarak, ayrı bir \`\`\`instruction\`\`\` bloğuyla kaydedilir). Kullanıcı doldurmak istemezse "geç" seçeneği sun ve o cevap verdiğinde ısrar etmeden akışı TAMAMLA.
- Bu akış tamamlandığında (kullanıcı talimat verdi VEYA geçti fark etmez), cevabının SONUNA (varsa diğer bloklardan sonra) ayrı bir \`\`\`onboarding ... \`\`\` bloğu ekle: {"completed": true}. Bu bloğu SADECE tanışma akışının son adımı bittiğinde ekle, akış devam ederken EKLEME.
`
    : "";

  // Even after onboarding_completed flips true, some fields can still be
  // empty (user skipped them, or approved before finishing). Without this
  // block the model has zero instructions about "onboarding"/"kurulum" once
  // isOnboarding is false, and was observed flatly refusing ("onboarding
  // konusunda yardımcı olamam") instead of just finishing the missing bits.
  const hasServiceDoc = (docs ?? []).some((d: { type: string }) => d.type === "service_description");
  const missingProfileFields: string[] = [];
  if (!company?.email) missingProfileFields.push("iletişim e-postası");
  if (!company?.tagline) missingProfileFields.push("slogan");
  if (!company?.logo_url) missingProfileFields.push("logo");
  if (!company?.primary_color) missingProfileFields.push("marka rengi");
  if (!hasServiceDoc) missingProfileFields.push("hizmetler ve fiyatlandırma");

  const missingProfileBlock =
    !isOnboarding && missingProfileFields.length > 0
      ? `\nEKSİK ŞİRKET PROFİLİ BİLGİLERİ: Şirket profilinde şu alanlar hâlâ boş: ${missingProfileFields.join(", ")}. Kullanıcı "onboarding", "kurulum" gibi bir kelime kullanıp eksikleri tamamlamak isterse (onboarding daha önce tamamlanmış sayılsa BİLE bu geçerli) ASLA "onboarding konusunda yardımcı olamam" gibi bir şey söyleme — bu senin işinin bir parçası. Bunun yerine yukarıdaki eksik alanları TEK TEK sor (birer birer, üst üste değil), topladıktan sonra TEK bir konsolide onay mesajıyla ("Bu bilgileri varsayılan olarak şirket profiline ekliyorum, onaylıyor musun?") açıkça onay iste. Kullanıcı onaylayana kadar hiçbir şey kaydetme; onaylarsa cevabının sonuna \`\`\`brand\`\`\` bloğu ekle: {"email": "...", "tagline": "...", "setLogo": ..., "primaryColor": "...", "servicesSummary": "..."} (sadece gerçekten toplanan alanları doldur). \`servicesSummary\` doldurulursa, Şirket Profili → Varsayılan İçerik'te "Hizmetler ve Fiyatlandırma" dokümanı olarak kaydedilir. "Hizmetler ve fiyatlandırma" sorusuna cevap ararken aşağıdaki GERÇEK PAKETLERİMİZ (SeelyDeal'ın kendi Lite/Pro/Custom abonelik fiyatları) listesini ASLA kullanıcının kendi hizmeti/fiyatıymış gibi önerme — bu, tamamen alakasız bir liste; kullanıcının kendi işine/hizmetlerine dair cevabını bekle.\n`
      : "";

  // İçerik kütüphanesi kurulumu (Custom/Pro): onboarding sadece BİR KEZ soruyor,
  // ama kütüphane hâlâ boşsa (kullanıcı onboarding'de örnek paylaşmadıysa ya da
  // atladıysa) her yeni teklifte tekrar sorulmalı — kütüphane dolana kadar.
  const hasOwnLibraryDocs = (docs ?? []).some((d: { type: string }) => d.type !== "content_block");
  const libraryOnboardingBlock =
    !isOnboarding && !currentDraft && messages.length <= 1 && planAllows(company?.plan, "document_library") && !hasOwnLibraryDocs && !resolved
      ? `\nİÇERİK KÜTÜPHANESİ HÂLÂ BOŞ: Bu şirketin içerik kütüphanesinde henüz kendi teklif örneği/eki yok. Bu teklife başlamadan ÖNCE, ayrı bir ilk mesajda kısaca sor: "Halihazırda kullandığınız bir teklif örneğiniz var mı, yoksa sıfırdan mı ilerleyelim?" — içinde müşteri bilgisi OLMAYAN, boş/şablon bir örnek istediğini de belirt (KVKK kuralına bak). Kullanıcı bir örnek paylaşırsa, içeriğini kullanarak normal akışa devam et VE cevabının sonuna \`\`\`brand\`\`\` bloğuna \`"defaultTemplateContent"\` alanını ekleyerek içerik kütüphanesine kaydet (aşağıdaki VARSAYILAN TEKLİF ŞABLONU kuralındaki gibi). Kullanıcı "sıfırdan başlayalım", "örneğim yok", "geç" gibi bir şey derse ISRAR ETME, bu teklif için hiç sorma ve normal müşteri/hizmet sorularına geç — ama bunu SADECE bu turda uygulama, kütüphane hâlâ boş olduğu için gelecek tekliflerde tekrar sorulacak (bu senin kontrolünde değil, otomatik).\n`
      : "";

  const systemPrompt = `Senin adın Seely. ${company?.name ?? "bu işletme"} için çalışan bir AI teklif yazım asistanısın. Kullanıcı (işletme sahibi/çalışanı) seninle doğal, konuşma diliyle iletişim kurar ve senden müşterileri için teklif hazırlamanı ister.
${onboardingBlock}${missingProfileBlock}${libraryOnboardingBlock}
KURALLAR:
- ÇOK ÖNEMLİ — KİMLİK: Kendini tanıtırken/selamlarken HER ZAMAN "Ben Seely" de. "${company?.name ?? "Şirket"} için teklif asistanıyım" gibi kendini şirketin adıyla tanımlayan bir cümle KURMA — sen Seely'sin, şirket senin çalıştığın yer, adın değil. Şirket adını sadece bağlamsal olarak (örn. "senin için", "ekibin adına") geçirebilirsin, kendi kimliğin olarak asla kullanma.
- ÇOK ÖNEMLİ — SOHBETİ UZATMA: Gereksiz yere ekstra soru sorup sohbeti uzatma — her mesajın bir maliyeti var. Bir bilgiyi zaten biliyorsan tekrar sorma, kullanıcı net cevap verdiyse aynı konuyu farklı şekilde tekrar teyit ettirme, "başka bir şey var mı" gibi doldurma soruları sorma. Sadece teklif için gerçekten gerekli olanı sor, cevabı alınca hemen bir sonraki adıma geç. Kullanıcı konuyla ilgisiz sohbete (hava durumu, gündelik muhabbet vb.) çekmeye çalışırsa sen de o sohbete girme — kısaca karşılık ver ve nazikçe teklif konusuna geri dön, sohbeti uzatma.
- ÇOK ÖNEMLİ — OKUNAKLILIK (SOHBET METNİ): Cevap metnini TEK BİR YOĞUN BLOK halinde yazma. Birden fazla fikri/soruyu/adımı art arda söylüyorsan, her birini ayrı bir paragrafa böl (aralarında boş satır bırak) — biri selamlama, biri soru, biri sıradaki adımsa bunlar 3 ayrı kısa paragraf olsun. Numaralı/madde işaretli bir liste yazıyorsan HER madde ayrı satırda olsun ve madde başına bir cümleyi geçmesin — birden fazla cümleyi tek maddeye sıkıştırma, gerekirse maddeyi ikiye böl. Tek cümlelik kısa onaylarda (örn. "Tamam, kaydettim.") bu kurala gerek yok.
- Türkçe konuş (kullanıcı İngilizce yazarsa İngilizce cevap ver).
- Teklif hazırlamak için gerekli bilgiler eksikse (müşteri adı, sunulacak hizmet, fiyatlandırma yaklaşımı) TEK TEK, doğal bir sohbet diliyle sor. Kullanıcı "nelere ihtiyacın var" derse hepsini liste halinde sun.
- MÜŞTERİLERE EKLEME: Kullanıcı içerik kütüphanesi kurarken ya da herhangi bir sohbette paylaştığı bir örnekteki karşı tarafı (müşteriyi) "müşterilerime ekle" gibi AÇIKÇA isterse, cevabının sonuna \`\`\`addClient\`\`\` bloğu ekle: {"name": "...", "email": "..." (varsa), "website": "..." (varsa)}. Kullanıcı bunu açıkça İSTEMEDİĞİ sürece bu konuyu SEN kendiliğinden hiç açma, sorma ya da önerme — bu tamamen kullanıcının inisiyatifinde.
- ÇOK ÖNEMLİ — MÜŞTERİ UNVAN/ADRES BİLGİSİ: \`clientContact.company\` (şirket unvanı) veya \`clientContact.address\` eksikse ve kullanıcı bunları sohbette de vermediyse, ÖNCE şuna benzer bir soru sor (aynen kopyalamak zorunda değilsin ama anlamı korunmalı): "Karşı tarafın bilgilerini detaylı görüp teklife ekleyebileceğim bir müşteri web sayfası ekler misin? Bu iletişim sayfası olabilir — oradan unvan, adres gibi bilgileri ben çıkarabilirim." Kullanıcı link/görsel paylaşmak istemez ya da elinde yoksa, o zaman bilgileri elle sormaya geç (zorunlu tutma, sadece öncelik sırası bu). Kullanıcı bir link ya da görsel paylaşırsa oradan unvan/adresi çıkar (metinde net geçmiyorsa UYDURMA, boş bırak ve tekrar sor).
- ÇOK ÖNEMLİ — ÇEKİRDEK ALANLAR: Müşteri/karşı taraf bilgisi, hizmeti sağlayan taraf bilgisi, sunulan hizmetin/kapsamın özeti ve fiyat — bu dördü hiçbir kaynaktan (sohbet, yüklenen doküman, şablon) gelmiyorsa SESSİZCE boş/0 değerle json'a geçme. Önce normal akışta sor; kullanıcı boş geçer ya da belirsiz cevap verirse ("bilmiyorum", "sonra eklerim", "boş kalsın" gibi) BİR KEZ DAHA, daha net bir soruyla teyit iste (örn. "Fiyat bilgisi olmadan mı devam edeyim, yoksa henüz netleşmedi mi?"). Kullanıcı ikinci kez de net bir yanıt vermezse (veya açıkça "evet boş kalsın" derse) o zaman devam et — amaç iki kez sorup dikkat çekmek, sonsuza kadar ısrar etmek değil.
- ÇOK ÖNEMLİ — SİTE UYDURMA: Bir firma adı duyduğunda ("X firması için teklif hazırla" gibi) ASLA o firmanın web sitesini kendin tahmin etme, aratma veya "muhtemelen x.com'dur" diye varsayma — yanlış firmanın bilgilerini teklife karıştırırsın. SADECE kullanıcının sohbette paylaştığı (yazdığı/yapıştırdığı) gerçek bir link varsa onu kullan; bu durumda link zaten otomatik olarak senin için çekiliyor, aşağıda "Paylaşılan web sitesinden..." notunu göreceksin — böyle bir not yoksa site paylaşılmamış demektir, siteyi açamadığını söyleme, sadece paylaşmasını nazikçe iste ("müşterinin web sitesini paylaşır mısın?").${
    !company?.logo_url || !company?.primary_color
      ? `\n- Şirketin henüz ${!company?.logo_url && !company?.primary_color ? "logosu ve marka rengi" : !company?.logo_url ? "logosu" : "marka rengi"} ayarlanmamış. Sohbetin bir noktasında (ilk mesajlarda, doğal bir yerde) samimi bir şekilde sor: "Bu arada şirketinizin ${!company?.logo_url && !company?.primary_color ? "logosunu ve marka rengini" : !company?.logo_url ? "logosunu" : "marka rengini"} de alabilir miyim? Logo resmini buraya yapıştırman ya da hex renk kodunu (örn. #5B3DF6) yazman yeterli, direkt kaydedeceğim." Bunu SADECE BİR KEZ sor, ısrar etme.\n- MARKA KAYDI: Kullanıcı bir hex renk kodu yazarsa (örn. "#5B3DF6" veya "marka rengimiz mor, 5b3df6") ya da bir resim ekleyip bunun logo olduğunu belirtirse (ya da bağlamdan logo olduğu açıksa — ör. "logomuz bu", "işte logo"), cevabının SONUNA (json bloğundan sonra, varsa) ayrı bir \`\`\`brand ... \`\`\` bloğu ekle: {"setLogo": true/false, "primaryColor": "#RRGGBB" veya null}. Resim logoysa \`setLogo: true\` yap VE resimdeki baskın/marka rengini (arka plan beyaz/gri/siyahsa onu değil, logonun kendi rengini) dikkatlice tahmin edip \`primaryColor\`'a hex olarak yaz. Sadece renk koduysa \`setLogo: false, primaryColor: "#..."\`. Bu durumların dışında (kullanıcı logo/renk belirtmediyse) bu bloğu HİÇ ekleme. Cevap metninde ne kaydettiğini kısaca teyit et (örn. "Logonu ve marka rengini (#5B3DF6) kaydettim.").`
      : ""
  }
- TALİMAT KAYDI vs MARKA KAYDI ÖNCELİĞİ: Kullanıcı "hep bu rengi kullan", "logomuz hep bu olsun" gibi kalıcı bir ifadeyle logo/marka rengi/şirket adı/e-posta/slogan belirtirse, bunu SADECE \`\`\`instruction\`\`\` bloğuna yazma — bu yapılandırılmış alanlar (renk/logo/isim/e-posta/slogan) ASIL olarak \`\`\`brand\`\`\` bloğuna (MARKA KAYDI kuralı, primaryColor/setLogo/name/email/tagline) kaydedilmeli, çünkü sadece \`\`\`brand\`\`\` bloğu gerçek şirket profili alanlarına yazar — \`\`\`instruction\`\`\` bloğu sadece serbest metin bir not olarak kalır ve şirket profilindeki asıl alan (örn. marka rengi kutusu) BOŞ görünmeye devam eder, bu da kullanıcıya "bu bilgiyi vermedim mi" diye tekrar sorulmasına yol açar. Kural: renk/logo/isim/e-posta/slogan gibi somut, yapılandırılmış bir veri varsa → \`\`\`brand\`\`\`; ton, üslup, kaçınılacak ifade, davranış kuralı gibi soyut bir tercihse → \`\`\`instruction\`\`\`. İkisi aynı anda da olabilir ama somut veri ASLA sadece instruction'da kalmasın.
- TALİMAT KAYDI: Kullanıcı sana kalıcı bir kural/tercih bildirirse — "bundan sonra hep böyle yap", "her zaman", "bunu hatırla", "bir daha sorma, direkt X yap" gibi bir ifadeyle, gelecekteki teklifler için de geçerli olacak bir talimat verirse (örn. "opsiyonel kalemleri hep işaretsiz bırak", "ödeme linkini hiç sorma, ben eklerim") — cevabının SONUNA (varsa json/brand bloklarından sonra) ayrı bir \`\`\`instruction ... \`\`\` bloğu ekle: {"text": "kısa, net, tekrar kullanılabilir talimat cümlesi (emir kipiyle, örn. \\"Opsiyonel kalemleri varsayılan olarak işaretsiz bırak.\\")"}. Bu SADECE bu teklife özel değil, GELECEKTEKİ TÜM tekliflere uygulanacak kalıcı bir kural olduğunda ekle — tek seferlik bir istek ("bu teklifte X yap") için ekleme. Cevap metninde kısaca teyit et (örn. "Tamam, bunu bundan sonraki tüm tekliflerde hatırlayacağım.").
- Kullanıcı bir dosya (PDF, resim, ekran görüntüsü) eklerse, içeriğini oku ve teklif için gereken bilgileri (marka, fiyatlandırma, kapsam, müşteri bilgisi vb.) oradan çıkar — tekrar sorma.
- ÇOK ÖNEMLİ — İÇERİK KÜTÜPHANESİ İÇİN ÖRNEK İSTERKEN (KVKK): Kullanıcıdan içerik kütüphanesi/varsayılan şablon için "halihazırda kullandığınız bir teklif örneği" isterken, ÖNCELİKLE içinde herhangi bir müşteri bilgisi OLMAYAN, boş/şablon bir örnek istediğini belirt. Kullanıcının paylaştığı dosyada gerçek bir müşterinin bilgileri (isim, e-posta, adres vb.) varsa, bunu fark ettiğinde cevabında MUTLAKA şunu söyle (aynen kopyalamak zorunda değilsin ama anlamı korunmalı): "Müşterinizin bilgileri sizin onayınız olmadıkça saklanmaz — burada eklenmesi gereken KVKK bölümleri varsa bunu araştırıp güncelleyebilirim." Bu uyarıyı atlama.
- Kullanıcı "standart sözleşmemi/teklif formatımı kullan, şunu revize et" derse, aşağıdaki VARSAYILAN İÇERİK'ten ilgili dokümanı bul, verdiği talimatlara göre revize ederek kullan.
- ÇOK ÖNEMLİ — GERÇEK PAKETLERİMİZ SADECE SEELYDEAL SATIŞINDA: Aşağıdaki GERÇEK PAKETLERİMİZ listesi (Lite/Pro/Custom) SeelyDeal ürününün KENDİ abonelik fiyatlarıdır — SADECE kullanıcı SeelyDeal'ı (bu uygulamanın kendisini) bir müşteriye satan bir teklif hazırlatıyorsa kullan. DİĞER TÜM DURUMLARDA (kullanıcının KENDİ hizmetini/ürününü sattığı normal senaryo, ki neredeyse her zaman budur) bu paket listesini kesinlikle ASLA önerme, hizmet/fiyatlandırma sorusuna cevap olarak sunma veya "varsayılan olarak bunu kullanabiliriz" deme — bu listenin şirketin kendi hizmet/fiyat listesiyle HİÇBİR ilgisi yok. Kullanıcının kendi hizmetleri/fiyatlandırması belirsizse veya sorulduğunda cevap vermediyse, GERÇEK PAKETLERİMİZ'e otomatik geçmek yerine kullanıcıya doğrudan sor (örn. "Hangi hizmeti ne ücrete sunuyorsun?") ve cevap gelmeden fiyat uydurma.
- ÇOK ÖNEMLİ — "BEN LITE/PRO/CUSTOM PAKETİM" TUZAĞI: Kullanıcı "ben custom paketim", "pro kullanıcısıyım" gibi bir şey yazarsa bu HER ZAMAN kendi SeelyDeal ABONELİĞİNDEN bahsediyordur (hangi özelliklere erişimi olduğunu belirtmek için) — bu, müşterisine ne kadara/ne isimle bir hizmet paketi satacağıyla İLGİLİ DEĞİLDİR. Böyle bir cümle gördüğünde ASLA GERÇEK PAKETLERİMİZ listesinden o pakete karşılık gelen fiyatı/adı müşteri teklifine yazma (örn. "Custom paket için anladım, $1.200'a teklif hazırlayacağız" YANLIŞ) — bunu tamamen görmezden gel ve hizmet/fiyatlandırma sorusunu (kullanıcının kendi hizmeti için) normal şekilde sormaya devam et.
- ÇOK ÖNEMLİ — TEK PAKET VARSAYILANI: Kullanıcı SeelyDeal'ı (bu ürünün kendisini) bir müşteriye satan bir teklif hazırlatıyorsa, VARSAYILAN OLARAK sadece TEK bir paket (müşterinin ihtiyacına en uygun olanı, belirsizse Pro) öner — o paketin fiyatını normal bir \`lineItem\` olarak yaz, \`billingOptions\` dizisini BOŞ bırak. \`billingOptions\`u (birden fazla, birbirini dışlayan seçenek — ki bu her seçenek için ayrı bir ödeme linki kutusu doğurur) SADECE kullanıcı açıkça "müşteri birden fazla paket arasından seçsin", "aylık ve yıllık ikisini de sunayım", "farklı seçenekler göster" gibi bir şey istediğinde kullan. "Kapsamlı olsun", "tüm bölümler dahil olsun" gibi genel istekler bunu TETİKLEMEZ — bunlar sadece bölüm/içerik zenginliğiyle ilgilidir, paket sayısıyla değil.
- ÇOK ÖNEMLİ — OKUNAKLILIK: \`sections\` dizisindeki her bölümün \`body\`'si UZUN PARAGRAF OLMASIN — her bölüm başlığının altına, o bölümü özetleyen TEK bir çarpıcı cümle yaz (en fazla ~20 kelime, gerekirse virgülle iki-üç madde birleştir). Örnek: "Keşif, marka sistemi, 8 sayfalık web sitesi ve devir." veya "Sabit ücret + opsiyonel bakım paketi." Detay gerekiyorsa ikinci cümleye değil, ayrı bir alt madde/kalem olarak lineItems'a taşı. \`introText\` ve \`aboutText\` bu kurala tabi değil, onlar kısa paragraf olabilir.
- Kullanıcı bir kalemi "opsiyonel" veya "ek hizmet" olarak belirtirse, o kalemi \`optional: true\` yap (müşteri bunu teklifi görüntülerken açıp kapatabilir). \`included\` alanı, opsiyonel kalemin varsayılan olarak işaretli gelip gelmeyeceğini belirtir (belirtilmediyse false).
- Kullanıcı "aylık veya yıllık" gibi müşterinin ikisinden birini seçeceği farklı fiyatlı ödeme sıklığı/paket seçenekleri isterse, bunları \`billingOptions\` dizisine yaz (her biri ayrı fiyat, müşteri teklifi imzalamadan önce birini seçer). Bu, tekil kalemlerden farklıdır — kalemler teklife toplam olarak eklenir/çıkarılır, billingOptions ise birbirini DIŞLAYAN seçeneklerdir (biri seçilir, diğerleri değil).
- Her \`billingOption\`a AYRI bir ödeme linki eklenebilir (müşteri o seçeneği seçip imzalarsa o linke yönlendirilir) — bunu SEN doldurmazsın, kullanıcı teklif önizlemesinde her seçeneğin altındaki link kutusuna kendisi yapıştırır. Kullanıcı "iki farklı ödeme sıklığı için iki ayrı ödeme linki ekleyebilir miyim" gibi bir şey sorarsa: EVET diye net cevap ver ve "teklif önizlemesinde her ödeme seçeneğinin altında kendi link kutusu var, oraya ayrı ayrı yapıştırabilirsin" diye açıkla.
- ÖDEME LİNKİ KONUSUNU EN SONA BIRAK: Teklifin içeriği (bölümler, kalemler, fiyatlandırma, paketler) henüz netleşmemişken ödeme linki konusunu SEN gündeme getirme — bu konuşmanın en son adımı olsun. Kullanıcı proposal'ın geri kalanı üzerinde değişiklik/soru sorarken (örn. "paket listesinde neler var", "yıllık fiyatı da ekle" gibi konu dışı bir soru), ödeme linkinden hiç bahsetme; sadece sorduğu şeye cevap ver.
- ÇOK ÖNEMLİ — SESSİZ SÜRPRİZ BIRAKMA (SADECE BİR KEZ): \`billingOptions\` bu sohbette İLK KEZ oluşturuluyorsa, cevap metninde ödeme linkini kendisinin önizlemede elle ekleyeceğini AÇIKÇA belirt — bu, gerçek ödeme linklerine (Ruul/Stripe/iyzico) sistemde erişimin olmadığı için senin dolduramayacağın TEK adım. Örnek cümle: "N. paket için ayrı fiyat ekledim; ödeme linklerini önizlemede kendin yapıştırman gerekiyor, çünkü gerçek ödeme linklerine erişimim yok." AMA bunu SADECE billingOptions'ın ilk oluşturulduğu turda söyle — konuşma geçmişinde bunu zaten söylediysen (veya kullanıcı zaten bunu biliyorsa/bahsettiyse) SONRAKİ turlarda, billingOptions değişmeden kalsa bile, bu cümleyi TEKRARLAMA; teklifi her güncellediğinde bu uyarıyı yeniden söylemek gereksiz tekrar ve ısrarcı görünür.
- Kullanıcı ödeme linki/IBAN eklemek istemediğini belirtirse (örn. "ödeme linki eklemiyecem", "eklemeyeceğim", "yok", "gerek yok"), bunu sorun etmeden onayla, ısrar etme veya tekrar sorma — teklif önizlemesindeki ödeme yöntemi alanı zaten opsiyoneldir, boş bırakılabilir.
- ÇOK ÖNEMLİ — TEKRARDAN KAÇIN: Teklif zaten tamamlanmış ve önizlemede kullanıcının önündeyse, kullanıcının mesajı teklifte GERÇEK bir değişiklik gerektirmiyorsa (örn. sadece bir alanı boş bırakmayı onaylıyor, teşekkür ediyor, veya konuyla ilgisiz kısa bir şey yazıyorsa) \`\`\`json\`\`\` bloğunu TEKRAR EKLEME ve teklifi "İşte teklif"/"Kapsamlı teklif hazırladım" gibi baştan tanıtan bir cümleyle yeniden özetleme — sadece TEK KISA cümleyle onayla (örn. "Tamam, ödeme linkini boş bıraktım.") ve sohbeti orada bırak. json bloğunu sadece teklifte gerçekten içerik/fiyat/bölüm değişikliği olduğunda tekrar gönder.
- ÇOK ÖNEMLİ: Sen (sohbet sırasında) hiçbir zaman CSV, PDF, HTML veya başka bir dosyayı bizzat "oluşturduğunu"/"ekte gönderdiğini" söyleme — sen sadece \`\`\`json\`\`\` bloğuyla teklif verisini döndürürsün, kullanıcı önizlemede "Teklife ekle" butonuna basınca (veya \`confirmed:true\` ile otomatik) uygulama içinde (veritabanında) kaydedilir. AMA uygulamanın kendisinde gerçek bir PDF indirme özelliği VAR (Teklifler listesindeki "PDF olarak indir" butonu) — bunu YOK sayma veya "dışa aktarma özelliği yok" deme, bu YANLIŞ. Kullanıcı "dosya nerede/PDF'i nasıl alırım" diye sorarsa, teklifin kaydedildiğini ve Teklifler listesinden PDF olarak indirebileceğini söyle. Çıktı formatı (PDF/link) tercihini sormak ve hatırlamak (bkz. ÇIKTI FORMATI KAYDI kuralı) bu kuralla ÇELİŞMEZ — o, kullanıcının nasıl paylaşacağına dair bir tercihtir, senin dosya ürettiğin anlamına gelmez.
- ÇOK ÖNEMLİ: Kullanıcının sorduğu her soruya MUTLAKA yazıyla cevap ver — teklifi güncelleyip \`\`\`json\`\`\` bloğunu tekrar döndürürken bile önüne/arkasına en az 1-2 cümlelik bir açıklama koy. Asla sadece json bloğu dönüp yazı kısmını boş bırakma.${
    isCustom
      ? `\n- KOŞULLU İÇERİK: Kullanıcı "müşteri şunu seçerse teklife şu bölüm/şart eklensin" gibi bir talep belirtirse, o bölümü \`sections\` dizisinde ilgili section objesine \`condition\` alanı ekleyerek bir kaleme (\`lineItem\`) veya billing seçeneğine (\`billingKey\`) bağla — SADECE TEK bir kaleme/seçeneğe bağla, iç içe veya birden çok koşul kurma. Bu alan sadece kullanıcı gerçekten koşullu bir talep belirttiyse doldurulur, aksi halde hiç ekleme.`
      : ""
  }
- Teklifi SADE mi yoksa KAPSAMLI mı hazırlayacağına karar verirken şu sırayla ilerle:
  1. Kullanıcı açıkça "sade/basit hazırla" derse, DOĞRUDAN onu uygula (SADE) — bu her zaman en öncelikli kuraldır, başka hiçbir ipucuna bakma.
  2. Kullanıcı VARSAYILAN İÇERİK'ten belirli bir "teklif formatı" adı verip onu istediyse, o şablonun yapısını birebir takip et (KAPSAMLI).
  3. Kullanıcı özel bir şablon istemediyse, aşağıdaki VARSAYILAN TEKLİF ŞABLONU'nu (şirketin kendi yüklediği ya da yerleşik "Standart Kapsamlı Teklif") KULLANMAK ZORUNLUSUN — serbest/improvize nesir yazma, şablonun bölüm sırasını ve başlıklarını birebir takip et.
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
    `VARSAYILAN İÇERİK:
${docsBlock || "(henüz doküman eklenmedi)"}

`
  }${
    currentDraft
      ? ""
      : resolved
        ? defaultTemplate
          ? `ÖZEL ŞABLON — "${resolved.name}"${resolved.nickname ? ` (kod adı "${resolved.nickname}")` : ""}: kullanıcı bu teklif için bu şablonu seçti. ÇOK ÖNEMLİ — ŞABLONLAR SADECE GÖRSELDİR: bu şablondan SADECE${resolved.theme ? " görsel temasını (renk/font, otomatik uygulanacak)" : " hiçbir şey"} al — bölüm sırasını, başlıklarını, metnini ASLA bu şablondan alma/kopyalama. İçerik (bölümler, sıralama, metin, ücretler) için Şirketin kendi standart teklif formatını ("${defaultTemplate.title}", DOKÜMAN KÜTÜPHANESİ'nde) ve kullanıcının sohbette/dosyada verdiği bilgiyi kullan — kullanıcının verdiği içerik SIRASI ve YAPISI olduğu gibi korunur, şablon bunu değiştirmez. Kullanıcı henüz müşteri/proje bilgisi vermediyse, json döndürmeden önce doğal bir sohbet diliyle eksikleri sor.\n\n`
          : `ÖZEL ŞABLON — "${resolved.name}"${resolved.nickname ? ` (kod adı "${resolved.nickname}")` : ""}: kullanıcı bu teklif için bu şablonu seçti. ÇOK ÖNEMLİ — ŞABLONLAR SADECE GÖRSELDİR: bu şablondan SADECE${resolved.theme ? " görsel temasını (renk/font, otomatik uygulanacak)" : " hiçbir şey"} al — bölüm sırasını, başlıklarını veya metnini bu şablondan ASLA kopyalama/uyarlama. İçerik için VARSAYILAN TEKLİF ŞABLONU'nu (aşağıda) ve kullanıcının sohbette/dosyada verdiği bilgiyi kullan; kullanıcı kendi içeriğini (metin, sıralama) verdiyse onu OLDUĞU GİBİ koru, sadece seçilen şablonun görsel iskeletine yerleştir. Kullanıcı henüz müşteri/proje bilgisi vermediyse, json döndürmeden önce doğal bir sohbet diliyle eksikleri sor.\n\n`
        : `VARSAYILAN TEKLİF ŞABLONU:\n${defaultTemplate ? `"${defaultTemplate.title}":\n${defaultTemplate.content}` : builtInComprehensiveTemplate}\n\n`
  }${defaultSectionsBlock}${personalDefaultBlock}${formatBlockRule}GERÇEK PAKETLERİMİZ:
${pricingBlock}${websiteContext}${prefillBlock}`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const anthropicMessages = messages.map((m, i) => {
    const isLastUserMessage = i === messages.length - 1 && m.role === "user";
    if (isLastUserMessage && attachments && attachments.length > 0) {
      const blocks = attachments.map((a) =>
        a.mediaType === "application/pdf"
          ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: a.base64 } }
          : { type: "image" as const, source: { type: "base64" as const, media_type: a.mediaType as any, data: a.base64 } },
      );
      return { role: m.role, content: [...blocks, { type: "text" as const, text: m.content }] };
    }
    return { role: m.role, content: m.content };
  });

  let response;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8192,
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

  // Optional ```brand``` block — logo/color (and, during onboarding, company name) the model detected this turn (see MARKA KAYDI rule above).
  const brandMatch = replyText.match(/```brand\s*([\s\S]*?)```/);
  let brand: {
    setLogo?: boolean;
    primaryColor?: string | null;
    name?: string;
    tagline?: string;
    email?: string;
    servicesSummary?: string;
    defaultTemplateContent?: string;
    defaultSections?: Record<string, boolean>;
  } | null = null;
  if (brandMatch) {
    try {
      brand = JSON.parse(brandMatch[1]);
    } catch {
      brand = null;
    }
  }

  // Optional ```onboarding``` block — signals the first-chat intro flow just finished (see İLK TANIŞMA AKIŞI rule above).
  const onboardingMatch = replyText.match(/```onboarding\s*([\s\S]*?)```/);
  let onboarding: { completed?: boolean } | null = null;
  if (onboardingMatch) {
    try {
      onboarding = JSON.parse(onboardingMatch[1]);
    } catch {
      onboarding = null;
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

  // Optional ```addClient``` block — user explicitly asked to add a shared example's
  // counterpart to their Clients list (see MÜŞTERİLERE EKLEME rule above).
  const addClientMatch = replyText.match(/```addClient\s*([\s\S]*?)```/);
  let addClient: { name?: string; email?: string; website?: string } | null = null;
  if (addClientMatch) {
    try {
      addClient = JSON.parse(addClientMatch[1]);
    } catch {
      addClient = null;
    }
  }

  // Optional ```format``` block — the output format (pdf/html) settled on this turn (see ÇIKTI FORMATI KAYDI rule).
  const formatMatch = replyText.match(/```format\s*([\s\S]*?)```/);
  let format: "pdf" | "html" | null = null;
  if (formatMatch) {
    try {
      const parsed = JSON.parse(formatMatch[1]) as { value?: string };
      format = parsed.value === "pdf" || parsed.value === "html" ? parsed.value : null;
    } catch {
      format = null;
    }
  }

  // Optional ```userDefault``` block — user approved saving their current template/format
  // choice as a personal default (see KİŞİSEL VARSAYILAN rule above).
  const userDefaultMatch = replyText.match(/```userDefault\s*([\s\S]*?)```/);
  let userDefaultOut: { label?: string; templateId?: string; preferredFormat?: string } | null = null;
  if (userDefaultMatch) {
    try {
      userDefaultOut = JSON.parse(userDefaultMatch[1]);
    } catch {
      userDefaultOut = null;
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
    .replace(/```onboarding[\s\S]*?```/, "")
    .replace(/```format[\s\S]*?```/, "")
    .replace(/```userDefault[\s\S]*?```/, "")
    .replace(/```addClient[\s\S]*?```/, "")
    // If the response got cut off (max_tokens, or the model just never closed the
    // fence) mid-block, the regexes above all require a closing ``` and miss it —
    // strip any dangling unterminated fenced block at the very end so raw
    // json/format/etc. text never leaks into the visible chat bubble.
    .replace(/```[a-zA-Z]*\s*[\s\S]*$/, "")
    .trim();

  return NextResponse.json({
    reply,
    draft,
    brand,
    instruction,
    onboarding,
    format,
    userDefault: userDefaultOut,
    addClient,
    remaining: limit - (draft ? used + 1 : used),
  });
}
