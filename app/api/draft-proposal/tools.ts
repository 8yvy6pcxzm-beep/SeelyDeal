import type { createServiceClient as CreateServiceClient } from "@/lib/supabase/server";
import { createLegalBlockFromDocument } from "@/lib/proposal-blocks/legal-block";
import { createTextBlockFromDocument } from "@/lib/proposal-blocks/text-block";
import { isSeelyDealPricingLeak } from "@/lib/seelydeal-pricing-leak";
import type { ProposalBlock } from "@/lib/types/proposal-blocks";
import { planAllows } from "@/lib/plan";

/** Real Content Library RAG tools — moved verbatim out of v1's
 *  app/api/draft-proposal/route.ts (see AI-ARCHITECTURE-V2.md §9: this
 *  business logic is explicitly NOT changing in the v2 refactor, only how
 *  it's wired into the request lifecycle). All tools are read-scoped to the
 *  caller's own company_id; the add tools never write to `company_documents`
 *  — they only produce an in-memory block appended to `draft.blocks` (deep-copy
 *  guarantee, see lib/proposal-blocks/legal-block.ts / text-block.ts). */
export const contentLibraryTools = [
  {
    name: "search_content_library",
    description:
      "Şirketin İçerik Kütüphanesi'nde (company_documents) canlı arama yapar — sözleşme/NDA metinleri, hizmet açıklamaları, fiyatlandırma/teklif şablonları ve serbest içerik blokları dahil. Kullanıcı 'kütüphanemdeki X'i kullan/ekle' gibi bir şey istediğinde, önce bunu çağırıp doğru dokümanı bul.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["contract", "proposal_template", "service_description", "other", "content_block", "reference", "company_material"],
          description:
            "Doküman türüne göre filtrele (opsiyonel). Sözleşme/NDA için 'contract'; hizmet açıklaması için 'service_description'; fiyat tablosu/kalem listesi genelde 'proposal_template' ya da 'service_description' içinde metin olarak bulunur (ayrı bir DB tipi yok); örnek teklif/varsayılan iskelet için 'proposal_template'; referans/vaka çalışması için 'reference'; genel şirket materyali için 'company_material'; serbest içerik parçaları için 'content_block'.",
        },
        query: { type: "string", description: "Başlık/içerikte aranacak serbest metin (opsiyonel)." },
      },
    },
  },
  {
    name: "add_legal_block_to_proposal",
    description:
      "İçerik Kütüphanesi'ndeki bir dokümanı (örn. NDA, gizlilik sözleşmesi — type: 'contract'), o teklife özel BAĞIMSIZ bir kopya olarak, teklifin SONUNA düzenlenebilir bir 'Legal' blok halinde ekler. Kaynak dokümanın kendisini ASLA değiştirmez — sadece bu teklife ait ayrı bir kopya oluşturur, kütüphanedeki orijinal doküman aynen kalır.",
    input_schema: {
      type: "object" as const,
      properties: {
        documentId: { type: "string", description: "search_content_library sonucundan alınan doküman id'si." },
        requireSignature: { type: "boolean", description: "Bu blok için ayrı imza zorunlu tutulsun mu (varsayılan false)." },
      },
      required: ["documentId"],
    },
  },
  {
    name: "add_text_block_from_library",
    description:
      "İçerik Kütüphanesi'ndeki bir hizmet açıklaması/içerik bloğu dokümanını (type: 'service_description', 'content_block' veya 'other'), o teklife özel BAĞIMSIZ bir kopya olarak, teklifin ilgili bölümüne (ör. Teslim Edilecekler, Stratejimiz) düzenlenebilir bir metin ('RichSection') blok halinde ekler. Kaynak dokümanı ASLA değiştirmez. Fiyat tablosu/kalem listesi eklemek için bu aracı KULLANMA — kütüphaneden çektiğin fiyat kalemlerini emit_draft'ın \\`lineItems\\` alanına kalem kalem ekle, çünkü teklifin fiyat tablosu ayrı bir bloğun içinde değil, her zaman teklifin kendi \\`lineItems\\`'ından üretilir.",
    input_schema: {
      type: "object" as const,
      properties: {
        documentId: { type: "string", description: "search_content_library sonucundan alınan doküman id'si." },
        sectionLabel: {
          type: "string",
          description: "Bloğun görüneceği bölüm başlığı (ör. 'Teslim Edilecekler', 'Stratejimiz'). Verilmezse doküman başlığı kullanılır.",
        },
        icon: { type: "string", enum: ["team", "timeline", "strategy"], description: "Opsiyonel bölüm ikonu." },
      },
      required: ["documentId"],
    },
  },
  {
    name: "generate_custom_text_block",
    description:
      "İçerik Kütüphanesi'nde UYGUN bir doküman YOKSA (search_content_library'de bulunamadıysa ya da kullanıcı açıkça 'sıfırdan yaz' dediyse) kullanılır — SEN kendi yazdığın bir metni, teklife özel bağımsız bir blok olarak ekler. 'legal' tipi bir sözleşme/NDA/hukuki madde bloğu (teklifin sonuna, imzalanabilir), 'text' tipi ise normal bir bölüm metni (Teslim Edilecekler, Stratejimiz vb.) üretir. Bu araçla eklenen içerik HİÇBİR ZAMAN company_documents'a (İçerik Kütüphanesi'ne) yazılmaz — sadece bu tekliften. Kullanıcı bunu kütüphaneye de kaydetmek isterse ayrıca save_to_content_library çağır.",
    input_schema: {
      type: "object" as const,
      properties: {
        blockType: { type: "string", enum: ["legal", "text"], description: "'legal' = imzalanabilir sözleşme/madde bloğu, 'text' = normal bölüm metni." },
        title: { type: "string", description: "Blok başlığı (legal) ya da bölüm başlığı (text)." },
        content: { type: "string", description: "SENİN yazdığın tam metin — placeholder değil, gerçek içerik." },
        requireSignature: { type: "boolean", description: "Sadece blockType 'legal' iken: bu blok için ayrı imza zorunlu tutulsun mu (varsayılan false)." },
        icon: { type: "string", enum: ["team", "timeline", "strategy"], description: "Sadece blockType 'text' iken: opsiyonel bölüm ikonu." },
      },
      required: ["blockType", "title", "content"],
    },
  },
  {
    name: "save_to_content_library",
    description:
      "Kullanıcı sohbette 'bunu kütüphaneye kaydet', 'bunu şablon olarak sakla', 'ileride tekrar kullanmak üzere ekle' gibi AÇIK bir onay verdiğinde çağrılır — verdiğin metni (bu teklifte az önce ürettiğin bir bölüm, sözleşme maddesi, ya da kullanıcının onayladığı başka bir parça) company_documents'a YENİ bir satır olarak yazar. Kaynağı/mevcut taslağı DEĞİŞTİRMEZ, sadece kütüphaneye bir kopya ekler. Kullanıcı AÇIKÇA istemeden KENDİLİĞİNDEN çağırma.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Kütüphanedeki dokümanın başlığı." },
        content: { type: "string", description: "Kaydedilecek tam metin — placeholder değil, gerçek içerik." },
        type: {
          type: "string",
          enum: ["content_block", "contract", "proposal_template", "service_description", "other", "reference", "company_material"],
          description:
            "Serbest bir metin parçasıysa 'content_block' (varsayılan); tam bir sözleşme maddesiyse 'contract'; tam bir teklif iskeletiyse 'proposal_template'; hizmet/fiyat açıklamasıysa 'service_description'; vaka çalışması/referans ise 'reference'; genel şirket materyali ise 'company_material'.",
        },
      },
      required: ["title", "content"],
    },
  },
];

export const contentLibraryToolNames = new Set(contentLibraryTools.map((t) => t.name));

const LIBRARY_GATED_TOOLS = new Set([
  "search_content_library",
  "add_legal_block_to_proposal",
  "add_text_block_from_library",
  "save_to_content_library",
]);
const VALID_LIBRARY_TYPES = new Set([
  "content_block",
  "contract",
  "proposal_template",
  "service_description",
  "other",
  "reference",
  "company_material",
]);

export async function runContentLibraryTool(
  name: string,
  input: Record<string, unknown>,
  service: ReturnType<typeof CreateServiceClient>,
  companyId: string,
  plan: "lite" | "pro" | "custom",
  pendingLegalBlocks: ProposalBlock[],
  pendingContentBlocks: ProposalBlock[],
): Promise<string> {
  // Content Library (company_documents) is a Pro+ feature — same "document_library"
  // gate the UI already enforces (app/(app)/content/page.tsx). generate_custom_text_block
  // is deliberately NOT gated here: it never touches company_documents, it's the model
  // writing fresh content, which is a base capability on every plan.
  if (LIBRARY_GATED_TOOLS.has(name) && !planAllows(plan, "document_library")) {
    return JSON.stringify({
      error: "İçerik Kütüphanesi Pro ve Custom paketlerinde kullanılabilir. Bu şirket Lite planda — kullanıcıya yükseltmesi gerektiğini söyle, kütüphaneden bir şey ekleyemezsin.",
    });
  }

  if (name === "search_content_library") {
    let q = service.from("company_documents").select("id, type, title, content").eq("company_id", companyId);
    if (typeof input.type === "string") q = q.eq("type", input.type);
    const { data } = await q;
    const rows = (data ?? []) as { id: string; type: string; title: string; content: string | null }[];
    // Same corrupted-onboarding guard as v1 (see lib/seelydeal-pricing-leak.ts)
    // — now applied here instead of at prompt-build time, since v2 only ever
    // touches a document's full `content` inside this lazy RAG lookup.
    const clean = rows.filter((d) => !(d.type === "service_description" && isSeelyDealPricingLeak(d.content ?? "")));
    const query = typeof input.query === "string" ? input.query.toLowerCase() : "";
    const filtered = query ? clean.filter((d) => `${d.title} ${d.content ?? ""}`.toLowerCase().includes(query)) : clean;
    return JSON.stringify(
      filtered.slice(0, 10).map((d) => ({ id: d.id, type: d.type, title: d.title, preview: (d.content ?? "").slice(0, 200) })),
    );
  }

  if (name === "add_legal_block_to_proposal") {
    const documentId = typeof input.documentId === "string" ? input.documentId : "";
    const { data: doc } = await service
      .from("company_documents")
      .select("id, title, content")
      .eq("id", documentId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!doc) return JSON.stringify({ error: "Doküman bulunamadı." });

    const block = createLegalBlockFromDocument(doc) as Extract<ProposalBlock, { type: "Legal" }>;
    if (typeof input.requireSignature === "boolean") block.settings.requireSignature = input.requireSignature;
    pendingLegalBlocks.push(block);
    return JSON.stringify({ ok: true, title: block.title });
  }

  if (name === "add_text_block_from_library") {
    const documentId = typeof input.documentId === "string" ? input.documentId : "";
    const { data: doc } = await service
      .from("company_documents")
      .select("id, title, content")
      .eq("id", documentId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!doc) return JSON.stringify({ error: "Doküman bulunamadı." });

    const label = typeof input.sectionLabel === "string" && input.sectionLabel.trim() ? input.sectionLabel.trim() : doc.title;
    const icon = input.icon === "team" || input.icon === "timeline" || input.icon === "strategy" ? input.icon : "strategy";
    const block = createTextBlockFromDocument(doc, label, icon);
    pendingContentBlocks.push(block);
    return JSON.stringify({ ok: true, label });
  }

  if (name === "generate_custom_text_block") {
    const title = typeof input.title === "string" && input.title.trim() ? input.title.trim() : "Yeni Bölüm";
    const content = typeof input.content === "string" ? input.content.trim() : "";
    if (!content) return JSON.stringify({ error: "content boş olamaz." });

    if (input.blockType === "legal") {
      const block: ProposalBlock = {
        id: `legal-custom-${Date.now()}`,
        type: "Legal",
        title,
        content,
        settings: { requireSignature: input.requireSignature === true },
      };
      pendingLegalBlocks.push(block);
      return JSON.stringify({ ok: true, title });
    }

    const icon = input.icon === "team" || input.icon === "timeline" || input.icon === "strategy" ? input.icon : undefined;
    const block: ProposalBlock = {
      id: `text-custom-${Date.now()}`,
      type: "RichSection",
      label: title,
      body: content,
      ...(icon ? { icon } : {}),
    };
    pendingContentBlocks.push(block);
    return JSON.stringify({ ok: true, label: title });
  }

  if (name === "save_to_content_library") {
    const title = typeof input.title === "string" && input.title.trim() ? input.title.trim() : "Başlıksız blok";
    const content = typeof input.content === "string" ? input.content.trim() : "";
    if (!content) return JSON.stringify({ error: "content boş olamaz." });
    const type = typeof input.type === "string" && VALID_LIBRARY_TYPES.has(input.type) ? input.type : "content_block";

    const { data: doc, error } = await service
      .from("company_documents")
      .insert({ company_id: companyId, type, title, content })
      .select("id, type, title")
      .single();
    if (error) return JSON.stringify({ error: "Kütüphaneye kaydedilemedi." });
    return JSON.stringify({ ok: true, id: doc.id, title: doc.title, type: doc.type });
  }

  return JSON.stringify({ error: "Bilinmeyen araç." });
}
