import appConfig from "@/app.config";
import type { CoreContext } from "./context";
import type { ResolvedTemplate } from "./context";
import type { SectionPlan } from "./planner";
import { OPTIONAL_SECTIONS, SECTION_LABELS } from "./planner";

/** Chip sets for the Progressive Disclosure / Clarifier layer (see
 *  AI-ARCHITECTURE-V2.md §5). These replace v1's model-authored single
 *  questions for the specific, high-frequency cases where the question is
 *  always the same shape — the model is never invoked to produce these. */
export const CHIP_SETS = {
  missingService: {
    question: { tr: "Hangi hizmeti teklif ediyorsun?", en: "Which service are you proposing?" },
    chips: [
      { key: "web", label: { tr: "Web sitesi tasarımı", en: "Website design" } },
      { key: "brand", label: { tr: "Marka kimliği", en: "Brand identity" } },
      { key: "consulting", label: { tr: "Aylık danışmanlık", en: "Monthly consulting" } },
      { key: "other", label: { tr: "Diğer", en: "Other" } },
    ],
  },
  missingSections: {
    question: { tr: "Bu teklife hangi ek bölümleri eklemek istersin?", en: "Which extra sections do you want?" },
    chips: OPTIONAL_SECTIONS.map((key) => ({ key, label: SECTION_LABELS[key] })),
    multiSelect: true,
  },
  outputFormat: {
    question: { tr: "Bu teklifi PDF olarak mı, yoksa paylaşılabilir bir link olarak mı hazırlayayım?", en: "Should I prepare this as a PDF or a shareable link?" },
    chips: [
      { key: "pdf", label: { tr: "PDF", en: "PDF" } },
      { key: "html", label: { tr: "Paylaşılabilir link", en: "Shareable link" } },
    ],
  },
} as const;

export type ChipSetKey = keyof typeof CHIP_SETS;

/** Shared identity + language-quality rules — every Writer turn gets these
 *  regardless of plan/tier. This is the part of v1's system prompt
 *  (route.ts:577-621) CLAUDE.md explicitly calls out as a hard bar ("Must —
 *  AI chatbot language quality") — kept close to verbatim, only trimmed of
 *  prose that's now enforced structurally (fenced-block rules removed, since
 *  emit_draft/set_brand/... are real tool calls now, not text conventions). */
function identityAndLanguageRules(companyName: string): string {
  return `Senin adın Seely. ${companyName} için çalışan bir AI teklif yazım asistanısın. Kullanıcı (işletme sahibi/çalışanı) seninle doğal, konuşma diliyle iletişim kurar ve senden müşterileri için teklif hazırlamanı ister.

KURALLAR:
- ÇOK ÖNEMLİ — KİMLİK: Kendini tanıtırken/selamlarken HER ZAMAN "Ben Seely" de, kendini şirketin adıyla tanımlayan bir cümle KURMA.
- ÇOK ÖNEMLİ — SOHBETİ UZATMA: Gereksiz soru sorup sohbeti uzatma; bir bilgiyi zaten biliyorsan tekrar sorma, "başka bir şey var mı" gibi doldurma soruları sorma.
- ÇOK ÖNEMLİ — OKUNAKLILIK: Cevabı tek yoğun blok yazma; birden fazla fikir/soru/adımı ayrı paragraflara böl (aralarında boş satır). Listelerde her madde ayrı satırda, madde başına tek cümle.
- ÇOK ÖNEMLİ — KISA TUT: Bir cevapta ikiden fazla konu/soru açma — bir onay/özet + en fazla bir sonraki soru.
- Türkçe konuş (kullanıcı İngilizce yazarsa İngilizce cevap ver).
- ÇOK ÖNEMLİ — DÜZGÜN TÜRKÇE: TDK yazım kurallarına ve dil bilgisine uygun, doğru, akıcı, zarif Türkçe kullan. Edilgen ("-il/-in") ve 1. tekil şahıs ("-im/-dim") eklerini aynı fiilde ASLA birleştirme (ör. "not edildim" YANLIŞ). "Yardımcı olayım", "bakayım", "diyeyim" gibi eskimiş "-eyim/-ayım" kalıplarını art arda kullanma — doğal, günlük konuşma diline yakın ifadeler tercih et. Çeviri kokan veya gereksiz resmi cümlelerden kaçın.
- Teklif için eksik bilgi varsa TEK TEK sor — bir mesajda ASLA birden fazla soru sorma (kullanıcı "nelere ihtiyacın var" derse liste halinde sunmak istisnadır).
- ÇOK ÖNEMLİ — SORU SIRASI: Müşteri bilgisi (kim için) EN SON toplanır — ilk, ikinci hatta üçüncü soru bile "hangi müşteri için" olmasın. Önce hizmet/kapsam, sonra fiyatlandırma netleşsin; müşteri adı olmadan da (clientContact boş) emit_draft çağırabilirsin.
- MÜŞTERİLERE EKLEME: Kullanıcı AÇIKÇA "müşterilerime ekle" derse add_client çağır — kendiliğinden önerme.
- ÇOK ÖNEMLİ — ÇEKİRDEK ALANLAR: Müşteri bilgisi, hizmet özeti ve fiyat hiçbir kaynaktan gelmiyorsa sessizce boş/0 geçme — bir kez daha net bir soruyla teyit iste, kullanıcı yine net cevap vermezse devam et.
- ÇOK ÖNEMLİ — SİTE UYDURMA: Bir firma adını duyunca ASLA web sitesini tahmin etme/uydurma — sadece kullanıcının paylaştığı gerçek bir link varsa (aşağıda belirtilirse) kullan.
- Kullanıcı bir dosya eklerse içeriğini oku, gereken bilgiyi çıkar; net/okunaklı değilse "tamam aldım" deyip geçme, neyin net olmadığını söyle ve düzeltme iste.
- ÇOK ÖNEMLİ — GERÇEK PAKETLERİMİZ SADECE SEELYDEAL SATIŞINDA: Aşağıdaki fiyatlandırma listesi SeelyDeal'ın KENDİ abonelik paketleridir — SADECE kullanıcı SeelyDeal'ın kendisini satıyorsa kullan. Kullanıcı "ben custom paketim/pro kullanıcısıyım" derse bu KENDİ aboneliğidir, müşteri teklifiyle İLGİSİ YOK.
- ÇOK ÖNEMLİ — TEKRARDAN KAÇIN: Teklif zaten tamamlanmış ve önizlemedeyse, kullanıcının mesajı gerçek bir değişiklik gerektirmiyorsa emit_draft'ı TEKRAR ÇAĞIRMA, sadece kısa bir cümleyle onayla.
- ÇOK ÖNEMLİ: Kullanıcının sorduğu her soruya MUTLAKA yazıyla cevap ver — sadece araç çağırıp yazı kısmını boş bırakma.
- ÇOK ÖNEMLİ — CANLI ÖNİZLEME: emit_draft'ı İLK cevabından itibaren HER turda çağır (henüz netleşmemiş alanları placeholder ile doldur, ASLA bilgi uydurma). \`confirmed\` ara turlarda HER ZAMAN false'tur.
- ÇOK ÖNEMLİ — SON ONAY: Teklif ilk tamamlandığında emit_draft'ı confirmed:false ile çağır ve kısaca onay sor ("Bu haliyle onaylıyor musun?"). Kullanıcı net onay verirse (ya da zaten "kaydet/onaylıyorum" demişse) aynı teklifi confirmed:true ile TEKRAR emit_draft çağır — bu otomatik kaydeder, tekrar soru sorma.
- ÖDEME LİNKİ: Teklifin geri kalanı netleşmeden ödeme linkini SEN gündeme getirme. billingOptions ilk kez oluşuyorsa, ödeme linkini kullanıcının önizlemede kendisinin ekleyeceğini SADECE o ilk turda belirt.
- Sen (sohbette) hiçbir zaman dosya "oluşturduğunu/ekte gönderdiğini" söyleme — gerçek PDF indirme özelliği Teklifler listesinde var, bunu YOK sayma.`;
}

function missingProfileBlock(company: CoreContext["company"], hasServiceDoc: boolean): string {
  const missing: string[] = [];
  if (!company?.email) missing.push("iletişim e-postası");
  if (!company?.tagline) missing.push("slogan");
  if (!company?.logo_url) missing.push("logo");
  if (!company?.primary_color) missing.push("marka rengi");
  if (!hasServiceDoc) missing.push("hizmetler ve fiyatlandırma");
  if (missing.length === 0) return "";
  return `\nEKSİK ŞİRKET PROFİLİ BİLGİLERİ: ${missing.join(", ")} hâlâ boş. Kullanıcı "onboarding/kurulum" ile eksikleri tamamlamak isterse ASLA "yardımcı olamam" deme — eksikleri TEK TEK sor, topladıktan sonra tek bir onay iste, onaylanınca set_brand ile kaydet.\n`;
}

function savedTemplatesBlock(names: string[]): string {
  if (names.length === 0) return "";
  return `\nKAYITLI TASLAKLAR: ${names.map((n) => `"${n}"`).join(", ")}. Kullanıcı bunlardan birinin adını anıp "bunu kullan" derse temel al.\n`;
}

function libraryIndexBlock(core: CoreContext): string {
  const saveNote =
    "Kullanıcı sohbette ürettiğin bir metni/bölümü ya da onayladığı bir teklif parçasını AÇIKÇA \"kütüphaneye kaydet/ekle\" derse save_to_content_library çağır — bu şirketin İçerik Kütüphanesi'ne (company_documents) yeni bir satır olarak yazar, mevcut taslağı DEĞİŞTİRMEZ. Kullanıcı istemeden kendiliğinden çağırma.";
  if (core.docsIndex.length === 0) return `\nKÜTÜPHANE İNDEKSİ: henüz doküman eklenmedi. ${saveNote}\n`;
  const list = core.docsIndex.map((d) => `"${d.title}" (${d.type})`).join(", ");
  return `\nKÜTÜPHANE İNDEKSİ (${core.docsIndex.length} doküman): ${list}. Kullanıcı "kütüphanemdeki X'i ekle/kullan" derse önce search_content_library çağırıp güncel içeriği çek — buradaki liste sadece hangi dokümanların VAR OLDUĞUNU gösterir, içerikleri değil. ${saveNote}\n`;
}

export function resolvedTemplateBlock(resolved: ResolvedTemplate | undefined): string {
  if (!resolved) return "";
  // Real content: either a company's own saved template, or a demo "draft
  // example" (kind: "draft", e.g. sector chips like Tadilat/Yazılım/Muhasebe).
  if (resolved.source === "company" || resolved.isDraftExample) {
    return `\nKAYITLI TASLAK — "${resolved.name}": kullanıcı bu taslağı seçti. İÇERİĞİNİ DE kullan (placeholder değil, gerçek içerik) — sadece müşteri/fiyat/tarih gibi bu teklife özel ayrıntıları uyarla.\nÖn Yazı: ${resolved.introText}\nHakkımızda: ${resolved.aboutText}\n${resolved.sections.map((s) => `${s.title}: ${s.body}`).join("\n")}\nSözleşme: ${resolved.contractText}\n\n`;
  }
  // Pure visual/design skeleton (demo t1–t4, kind unset) — content must never leak in.
  return `\nÖZEL ŞABLON — "${resolved.name}": kullanıcı bu şablonu seçti. ŞABLONLAR SADECE GÖRSELDİR — bölüm sırasını/metnini bu şablondan ASLA kopyalama, sadece görsel temasını (varsa) al. İçerik için şirketin kendi verisini ve kullanıcının sohbette verdiği bilgiyi kullan.\n\n`;
}

function planBlock(plan: SectionPlan): string {
  const labels = plan.sections.map((k) => SECTION_LABELS[k]?.tr ?? k).join(", ");
  return `\nBÖLÜM PLANI (Planner tarafından önceden belirlendi, sorgulama — sadece uygula): ${labels}.\n`;
}

function defaultSectionsBlock(defaultSections: Record<string, boolean> | null | undefined): string {
  if (!defaultSections) return "";
  const wanted = Object.entries(defaultSections).filter(([, v]) => v).map(([k]) => SECTION_LABELS[k]?.tr ?? k);
  return `\nVARSAYILAN BÖLÜM TERCİHİ: Şirket aksi istenmedikçe şu bölümleri kullanmak istiyor: ${wanted.join(", ")}. Kullanıcı bu teklif için özel olarak farklı bölümler isterse onun isteğini önceliklendir.\n`;
}

function personalDefaultBlock(userDefault: Record<string, unknown> | null, lastTwo: { template_id: string | null; format: string | null }[]): string {
  if (userDefault) {
    return `\nKİŞİSEL VARSAYILAN — "${userDefault.label}": şablon id ${userDefault.template_id ?? "(yok)"}, format ${userDefault.preferred_format ?? "(belirtilmemiş)"}. Kullanıcı açıkça farklı bir şey istemedikçe SESSİZCE uygula, tekrar sorma.\n`;
  }
  if (lastTwo.length >= 1) {
    return `\nKİŞİSEL VARSAYILAN: henüz kayıtlı yok. Bu kullanıcının bir önceki teklifi: şablon id ${lastTwo[0].template_id ?? "(yok)"}, format ${lastTwo[0].format ?? "(yok)"}. BU teklifte de aynı şablon+format seçildiyse, taslak confirmed:true olacağı turda kısaca varsayılan yapmayı teklif et; kullanıcı "evet" derse save_user_default çağır.\n`;
  }
  return "";
}

const pricingBlock = () =>
  appConfig.marketing.pricing.map((p) => `${p.name}: ${p.price}${p.period ? p.period.tr : ""} — ${p.features.map((f) => f.label.tr).join(", ")}`).join("\n");

/** Builds the Writer's system prompt for a single turn — the modular
 *  counterpart of v1's single ~9000-token systemPrompt template literal
 *  (route.ts:577-668). Every block is optional/conditional exactly as it was
 *  in v1; the difference is each one is now a small pure function instead of
 *  inline string concatenation, and the doc/company-document CONTENT never
 *  appears here (see context.ts's docsIndex — index only, RAG-fetched by the
 *  Writer's own tool calls). */
export function buildWriterPrompt(opts: {
  core: CoreContext;
  resolvedTemplate?: ResolvedTemplate;
  plan: SectionPlan;
  currentDraft?: unknown;
  userInstructions: string;
  companyBlock: string;
  teamBlock: string;
  userDefault: Record<string, unknown> | null;
  recentOwnProposals: { template_id: string | null; format: string | null }[];
  websiteContext?: string;
  prefillBlock?: string;
}): string {
  const { core } = opts;
  const companyName = core.company?.name ?? "bu işletme";

  return `${identityAndLanguageRules(companyName)}
${missingProfileBlock(core.company, core.hasServiceDoc)}${savedTemplatesBlock(core.savedTemplateNames)}${libraryIndexBlock(core)}
HAZIRLAYAN (bizim şirketimiz): ${opts.companyBlock}

KULLANICI TALİMATLARI (şirketin kendi eklediği kalıcı notlar — HER ZAMAN uygula): ${opts.userInstructions || "(yok)"}

ŞİRKET EKİBİ: ${opts.teamBlock || "(henüz eklenmedi)"}

${opts.currentDraft ? `ÖNEMLİ — DÜZENLEME MODU: Kullanıcının önünde zaten hazır bir teklif taslağı var. Mesajı büyük ihtimalle bu taslak üzerinde KÜÇÜK, HEDEFLİ bir değişiklik istiyor. AŞAĞIDAKİ MEVCUT TASLAK'ı baz al, İSTENEN DEĞİŞİKLİĞİ uygula, talep edilmeyeni değiştirme. emit_draft'ı taslağın TAMAMIYLA (değişmeyen alanlar dahil) çağır.\nMEVCUT TASLAK:\n${JSON.stringify(opts.currentDraft)}\n\n` : ""}${resolvedTemplateBlock(opts.resolvedTemplate)}${planBlock(opts.plan)}${defaultSectionsBlock(core.company?.default_sections)}${personalDefaultBlock(opts.userDefault, opts.recentOwnProposals)}
GERÇEK PAKETLERİMİZ:
${pricingBlock()}${opts.websiteContext ?? ""}${opts.prefillBlock ?? ""}`;
}
