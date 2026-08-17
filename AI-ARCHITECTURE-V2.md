# Seely AI Motoru v2 — Orchestrator/Planner/Writer + Lazy RAG + SSE

Bu doküman, `ARCHITECTURE.md`'nin **3. AI teklif taslağı akışı** bölümünün yerini
alacak yeni tasarımdır. 1., 2. ve 4. bölümler (veri modeli, onboarding, teklif
yaşam döngüsü) AYNEN korunuyor — hiçbir Supabase tablosu/alanı değişmiyor, sadece
`app/api/draft-proposal/route.ts` içindeki tek-dev-prompt + regex mimarisi
modüler, streaming bir yapıya taşınıyor.

---

## 0. Neden değişiyor

Mevcut yapının somut maliyeti:

| Sorun | Kaynak |
|---|---|
| Her istekte ~9 tablo/sorgu paralel çekiliyor, tamamı promptun içine gömülüyor | `route.ts:325-346`, `docsBlock`, `savedTemplatesBlock` |
| Sistem promptu ~9000+ token, model her turda tüm kuralları yeniden "okuyor" | `systemPrompt` (577-668. satırlar) |
| Yanıt tamamen bitmeden client hiçbir şey görmüyor (non-streaming `messages.create`) | `anthropic.messages.create(...)` |
| Yapılandırılmış veri (`json`/`brand`/`instruction`/…) regex ile serbest metinden kazınıyor — kırılgan, kesik yanıtlarda leak riski var (kodun kendisi bunu itiraf ediyor, 851-855. satırlar) | `replyText.match(/\`\`\`json.../)` |
| Zayıf prompt ("teklif yaz") → model doğrudan placeholder'larla zayıf bir taslak üretiyor, yönlendirme yok | Serbest metin akışı |

Yeni tasarım bu beşini de doğrudan hedefliyor.

---

## 1. Üst mimari

```
Kullanıcı mesajı
      │
      ▼
┌─────────────┐   niyet: new_draft | revise | needs_info | tool_request
│ Orchestrator │──────────────────────────────────────────────┐
└─────────────┘                                                │
      │ needs_info                                             │ new_draft/revise
      ▼                                                         ▼
┌─────────────┐                                          ┌───────────┐
│ Clarifier    │  (chips + tek soru, stream)              │  Planner  │
└─────────────┘                                          └───────────┘
                                                                 │ section planı + gereken RAG sorguları
                                                                 ▼
                                                          ┌───────────┐
                                                          │  Writer   │──▶ SSE: metin + json parça parça
                                                          └───────────┘
                                                                 │ (opsiyonel tool-call)
                                                                 ▼
                                                          ┌───────────┐
                                                          │ RAG Tools │ (search_content_library, vb. — AYNI kalıyor)
                                                          └───────────┘
```

Dört katman da **aynı `/api/draft-proposal` route'unda**, ayrı fonksiyonlar/
modüller olarak yaşıyor — ayrı HTTP uçlarına bölmüyoruz (ekstra round-trip +
auth/kota kontrolünü tekrarlamak istemiyoruz). Modülerlik dosya seviyesinde.

### Yeni klasör yapısı

```
app/api/draft-proposal/
  route.ts                 ← ince: auth, kota, SSE response, orchestrate() çağrısı
  orchestrator.ts           ← niyet sınıflandırma (haiku-sınıfı, ucuz/hızlı model)
  planner.ts                 ← section planı çıkarımı (default_sections + template + niyet)
  writer.ts                   ← asıl içerik üretimi, stream eden model çağrısı
  context.ts                   ← lazy context loader (RAG) — company/docs/templates fetch'leri burada
  prompts.ts                    ← her katman için KÜÇÜK, odaklı sistem promptları (dev tek prompt yerine)
  tools.ts                       ← draftTools + runDraftTool (mevcut haliyle taşınıyor, değişmiyor)
  stream.ts                       ← SSE encode/decode yardımcıları, event tipi tanımları
  schema.ts                        ← Zod ile taslak/brand/instruction/format şemaları (regex'in yerini alıyor)
```

---

## 2. Orchestrator — niyet sınıflandırma

**Amaç:** Her mesajda 9000 token'lık dev promptu tetiklemeden önce, "bu mesaj
ne istiyor" sorusunu ucuz ve hızlı cevapla. `currentDraft` var/yok, mesaj
uzunluğu/içeriği gibi sinyallerle bunun büyük kısmı kod tarafında (LLM'siz)
çözülebilir — sadece belirsiz durumlarda küçük bir model çağrısı yapılır.

```ts
// orchestrator.ts
export type Intent =
  | { kind: "new_draft"; hasEnoughInfo: boolean }
  | { kind: "revise"; targetField?: string }       // "işçilik x2 olsun" gibi hedefli düzenleme
  | { kind: "needs_info"; missing: MissingField[] } // "teklif yaz" gibi zayıf prompt
  | { kind: "tool_request" };                        // "kütüphanemdeki NDA'yı ekle"

export function classifyIntent(
  messages: ChatMessage[],
  currentDraft: unknown,
): Intent {
  const last = messages.at(-1)!.content.trim();

  // 1) Kod-tarafı hızlı yollar — LLM çağrısı YOK:
  if (currentDraft && last.length < 200) return { kind: "revise" };
  if (/kütüphane|standart sözleşme|nda.?mı ekle/i.test(last)) {
    return { kind: "tool_request" };
  }

  // 2) Zayıf prompt tespiti: kelime sayısı + belirsizlik sinyalleri.
  const wordCount = last.split(/\s+/).length;
  if (!currentDraft && wordCount <= 6) {
    return { kind: "needs_info", missing: ["service", "pricing"] };
  }

  // 3) Belirsiz kalan azınlık durum için TEK küçük/hızlı model çağrısı
  //    (sonnet değil — küçük, ucuz bir sınıflandırma modeli; sadece
  //    "new_draft mı needs_info mi" gibi dar bir soru sorulur, tüm şirket
  //    bağlamı BURADA yüklenmez).
  return classifyWithFastModel(last, !!currentDraft);
}
```

Bu katman, mevcut kodda `fullChatText`, `matchNamedTemplate`,
`matchCompanyTemplateByName` ile zaten yapılan "regex/heuristik önce, LLM en
son" mantığını genelleştiriyor — o kısımları **atmıyoruz**, `orchestrator.ts`
içine taşıyıp genişletiyoruz.

---

## 3. Lazy Context Loading / RAG (`context.ts`)

Mevcut kodun en pahalı kısmı şu: `company`, `team`, `docs`, `userDefault`,
`recentOwnProposals`, `companyTemplates` — **hepsi her istekte** çekilip
promptun içine gömülüyor (`route.ts:325-346`, `docsBlock`).

Yeni model:

```ts
// context.ts
export type ContextTier = "core" | "docs" | "history" | "templates";

/** Her katman ayrı ayrı, İHTİYAÇ oldukça çekilir. */
export async function loadCoreContext(companyId: string) {
  // company + team_members — HER turda lazım (isim, marka, default_sections).
  // Küçük, ucuz — her zaman yükle.
}

export async function loadDocsIndex(companyId: string) {
  // company_documents'ın TAM içeriği değil, sadece {id, type, title} özeti.
  // Modelin "hangi doküman var" diye bilmesi için yeterli — asıl `content`
  // sadece search_content_library çağrıldığında, o dokümanın kendisi için
  // çekilir (mevcut tools.ts'deki davranışla birebir aynı).
}
```

Kritik fark: **`docsBlock` artık sistem promptunun içine tam metin olarak
basılmıyor.** Bunun yerine promptta sadece kısa bir index var:

```
KÜTÜPHANE İNDEKSİ (11 doküman): "Standart NDA" (contract), "Web Tasarım
Fiyat Listesi" (service_description), ...
İçeriğini görmek/kullanmak istediğinde search_content_library çağır.
```

Bu, Writer'ın `search_content_library` tool'unu her ihtiyaç duyduğunda
çağırmasını sağlıyor — mevcut `draftTools` (route.ts:137-201) zaten bu amaçla
var, sadece artık "yedek" değil "birincil" veri erişim yolu oluyor. Aynı
mantık `recentOwnProposals` (kişisel varsayılan/AI Prefill) için de geçerli:
tam satır değil, "geçmişin var, ister misin?" sinyali baştan gidiyor, detay
gerektiğinde ayrı bir dar sorguyla çekiliyor.

**Kalıcı/ucuz veri (her turda kalır):** `company.name/plan/ai_instructions`,
`default_sections`, `team_members` (kısa liste). Bunlar zaten küçük ve hemen
hemen her yanıtta lazım — RAG'a gerek yok.

**Talep-bazlı (lazy) veri:** `company_documents.content`, template'lerin tam
`sections/lineItems/blocks`'ı, geçmiş proposal detayları. Bunlar tool-call
veya Planner'ın açıkça istediği anlarda çekiliyor.

---

## 4. Planner

Orchestrator `new_draft` veya `revise` derse, Planner devreye giriyor. Görevi
**içerik üretmek değil, hangi bölümlerin/hangi sırada yazılacağının planını**
çıkarmak — mevcut kodun `sectionCatalog` + `defaultSectionsBlock` +
"BÖLÜM SEÇİM SORUSU" mantığının (route.ts:496-527, 627-631) kod-tarafı bir
karşılığı:

```ts
// planner.ts
export type SectionPlan = {
  sections: (keyof typeof SECTION_LABELS)[];
  needsUserChoice: boolean;   // default_sections hiç ayarlanmamışsa true
  templateSource: "demo" | "company" | "none";
  ragQueries: string[];        // Writer'ın baştan tetikleyeceği aramalar (ör. "kütüphanede fiyat listesi var mı")
};

export function plan(
  intent: Intent,
  core: CoreContext,          // company.default_sections, resolved template id
): SectionPlan {
  if (core.defaultSections) {
    return {
      sections: sectionsFrom(core.defaultSections),
      needsUserChoice: false,
      templateSource: core.resolvedTemplate?.source ?? "none",
      ragQueries: core.resolvedTemplate ? [] : ["service_description", "proposal_template"],
    };
  }
  // Hiç tercih yoksa: LLM'e sormadan, DOĞRUDAN needsUserChoice: true dönülür
  // → Clarifier katmanı devreye girer (bkz. §5), model israf edilmez.
  return { sections: CORE_SECTIONS, needsUserChoice: true, templateSource: "none", ragQueries: [] };
}
```

Bu katmanın kritik noktası: **planlama çoğunlukla LLM çağrısı gerektirmiyor**
— `default_sections` zaten DB'de var, deterministik kod bunu çözüyor. Planner
sadece belirsiz/karmaşık durumlarda (ör. kullanıcı "kapsamlı olsun ama
sözleşmesiz" gibi doğal dilde bölüm karması istediğinde) küçük bir model
çağrısı yapıyor.

---

## 5. Progressive Disclosure — Clarifier (chips)

`needsUserChoice: true` ya da Orchestrator `needs_info` dediğinde, Writer'a
hiç gidilmeden **Clarifier** devreye giriyor. Bu katman modele değil,
doğrudan kod + küçük bir "hangi chip seti" seçimine dayanıyor:

```ts
// prompts.ts
export const CHIP_SETS = {
  missingService: {
    question: { tr: "Hangi hizmeti teklif ediyorsun?", en: "Which service are you proposing?" },
    chips: (industry: string) => SERVICE_SUGGESTIONS[industry] ?? SERVICE_SUGGESTIONS.other,
  },
  missingSections: {
    question: { tr: "Bu teklife hangi ek bölümleri eklemek istersin?", en: "Which extra sections do you want?" },
    chips: () => OPTIONAL_SECTIONS, // Hakkımızda / Ekibimiz / Süreç / Sözleşme Şartları
    multiSelect: true,
  },
  outputFormat: {
    question: { tr: "PDF mi, paylaşılabilir link mi?", en: "PDF or a shareable link?" },
    chips: () => [{ key: "pdf", label: "PDF" }, { key: "html", label: { tr: "Link", en: "Link" } }],
  },
} as const;
```

SSE üzerinden client'a giden event:

```json
{ "type": "clarify", "question": "Hangi hizmeti teklif ediyorsun?",
  "chips": ["Web sitesi tasarımı", "Marka kimliği", "Aylık danışmanlık", "Diğer"] }
```

Client bunu bir seçim UI'ı olarak render ediyor (chip'e tıklamak = o metni
yeni user mesajı olarak gönderiyor). Bu, mevcut kodun "TEK TEK, doğal bir
sohbet diliyle sor" kuralının (route.ts:587) **yapılandırılmış** karşılığı —
serbest metin soru yerine tıklanabilir seçenek, ama aynı ilke (tek seferde
bir şey sor) korunuyor.

Zayıf prompt örneği ("teklif yaz"): Orchestrator → `needs_info`, Planner hiç
çağrılmıyor, doğrudan `missingService` chip seti stream ediliyor. Writer,
kullanıcı en az servis+fiyatlandırma verene kadar tetiklenmiyor — mevcut
kodun "ÇEKİRDEK ALANLAR sessizce boş geçilmez" kuralının (route.ts:591)
kod-tarafı garantisi.

---

## 6. Writer + SSE streaming

Writer, mevcut `systemPrompt`'un küçültülmüş, **role bazlı parçalı**
versiyonuyla çalışıyor — dil kalitesi kuralları, kimlik, format kuralları hâlâ
var ama artık:

- Şirketin **tam** doküman içerikleri değil, RAG index + gereken tool'lar var
- `resolvedTemplate` sadece Planner zaten seçtiyse gömülüyor (Writer tekrar
  karar vermiyor)

```ts
// writer.ts
export async function* streamDraft(opts: {
  plan: SectionPlan;
  core: CoreContext;
  messages: ChatMessage[];
  attachments?: Attachment[];
}) {
  const stream = await anthropic.messages.stream({
    model: MODEL,
    max_tokens: 8192,
    system: buildWriterPrompt(opts.plan, opts.core),   // prompts.ts — odaklı, ~1500-2000 token
    messages: toAnthropicMessages(opts.messages, opts.attachments),
    tools: draftTools,                                   // tools.ts — DEĞİŞMEDİ
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield { type: "text", delta: event.delta.text };
    }
    if (event.type === "content_block_stop") {
      // Anthropic SDK'nın partial-json birikimini kullanarak taslak JSON'ı
      // parça parça değil, TAMAMLANDIĞINDA tek seferde doğrula (Zod) ve yayınla —
      // yarım/kırık JSON'ı client'a hiç sızdırma.
    }
  }
  // Tool-use turu gerekiyorsa (search_content_library vb.) burada mevcut
  // 4-turluk döngü (route.ts:692-711) AYNEN çalışıyor — sadece artık
  // stream'in ortasında, ayrı bir "tool_use" SSE event'i olarak client'a
  // bildiriliyor (opsiyonel — "kütüphaneni kontrol ediyorum..." göstermek için).
}
```

### `route.ts` — yeni ince hali

```ts
// route.ts
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "..." }, { status: 401 });

  const { messages, currentDraft, templateId, attachments } = await req.json();
  const company = await loadCoreContext(companyId);       // context.ts — HAFİF
  await enforceQuota(company);                              // aynı ai_usage mantığı

  const intent = classifyIntent(messages, currentDraft);    // orchestrator.ts

  return sseResponse(async function* () {
    if (intent.kind === "needs_info") {
      yield clarifyEvent(intent, company);                   // Clarifier — LLM'siz
      return;
    }
    const sectionPlan = plan(intent, company);               // planner.ts
    if (sectionPlan.needsUserChoice) {
      yield clarifyEvent({ kind: "needs_info", missing: ["sections"] }, company);
      return;
    }
    for await (const chunk of streamDraft({ plan: sectionPlan, core: company, messages, attachments })) {
      yield chunk;                                            // writer.ts — SSE
    }
    await recordUsage(company, produced: true);
  });
}
```

### SSE event tipleri (`stream.ts`)

```ts
export type DraftEvent =
  | { type: "text"; delta: string }                 // sohbet metni, karakter/kelime akışı
  | { type: "clarify"; question: I18nText; chips: Chip[]; multiSelect?: boolean }
  | { type: "draft"; draft: ProposalDraft }           // Zod ile doğrulanmış TAM taslak (parça parça değil)
  | { type: "brand" | "instruction" | "format" | "addClient" | "userDefault"; payload: unknown }
  | { type: "tool_call"; name: string }                // opsiyonel UI: "kütüphaneni kontrol ediyorum"
  | { type: "done"; remaining: number }
  | { type: "error"; message: string };
```

`sseResponse` yardımcı fonksiyonu Next.js 16 Route Handler'da bir
`ReadableStream` döndürüp `text/event-stream` header'ı set ediyor —
`app/api/draft-proposal/stream.ts`:

```ts
export function sseResponse(gen: () => AsyncGenerator<DraftEvent>) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of gen()) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
      } catch (err) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: String(err) })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
```

Client tarafı (`EventSource` yerine `fetch` + `ReadableStream` okuma —
`EventSource` sadece GET destekler, biz POST body gönderiyoruz):

```ts
const res = await fetch("/api/draft-proposal", { method: "POST", body: JSON.stringify(payload) });
const reader = res.body!.getReader();
// her "data: {...}\n\n" parçasını DraftEvent olarak parse edip
// type'a göre UI'a uygula (text → sohbet balonuna ekle, draft → önizleme paneli,
// clarify → chip seçim bileşeni, brand/instruction/... → ilgili state).
```

---

## 7. Regex → Zod şema doğrulama (`schema.ts`)

Mevcut kodun en kırılgan noktası fenced-block regex'leri (route.ts:719-834).
Yeni yapıda modelden **yapılandırılmış tool-result** olarak taslak isteniyor
(Anthropic'in `tool_use` mekanizması `emit_draft` adında bir "sözde tool" gibi
kullanılıyor — gerçek bir yan etkisi yok, sadece modelin serbest metin yerine
şemaya uyan JSON üretmesini zorluyor):

```ts
// schema.ts
export const ProposalDraftSchema = z.object({
  title: z.string(),
  client: z.string(),
  value: z.number(),
  introText: z.string(),
  aboutText: z.string(),
  clientContact: ClientContactSchema,
  sections: z.array(SectionSchema),
  lineItems: z.array(LineItemSchema),
  billingOptions: z.array(BillingOptionSchema).default([]),
  nextSteps: z.array(NextStepSchema),
  validDays: z.number().default(15),
  contractText: z.string().optional(),
  confirmed: z.boolean().default(false),
});
```

`emit_draft` tool'u `draftTools` dizisine ekleniyor, `input_schema` doğrudan
Zod şemasından türetiliyor (`zod-to-json-schema`). Writer artık ```json```
fence yazmıyor — `tool_use` bloğu olarak taslağı dönüyor, `runDraftTool`
içinde `ProposalDraftSchema.parse(input)` ile doğrulanıyor. Kesik/kırık
JSON riski ortadan kalkıyor çünkü Anthropic tool-use çıktısı zaten
tamamlanmadan `tool_use` bloğu kapanmıyor.

`brand`/`instruction`/`format`/`addClient`/`userDefault` için de aynı mantık:
her biri kendi küçük Zod şemasına sahip birer "sözde tool" (`set_brand`,
`set_instruction`, `set_format`, `add_client`, `save_user_default`) — hepsi
`tools.ts`'de `draftTools` dizisine ekleniyor, `runDraftTool` bunları
`pendingXxx` dizilerine push etmek yerine doğrudan SSE event olarak
`yield` ediyor.

---

## 8. Migrasyon planı (kod tarafı, DB dokunulmuyor)

1. `schema.ts` + `tools.ts` (mevcut `draftTools`'u taşı, `emit_draft` ve
   diğer "sözde tool"ları ekle) — DB şeması sabit kalıyor.
2. `context.ts` — mevcut paralel `Promise.all` sorgularını tier'lara böl.
3. `prompts.ts` — dev `systemPrompt` string'ini rol bazlı parçalara böl
   (identity + dil kuralları hepsinde ortak; Writer'a özel kurallar ayrı).
4. `orchestrator.ts` + `planner.ts` — kod-tarafı heuristikler (mevcut
   `matchNamedTemplate` vb. buraya taşınır).
5. `stream.ts` — SSE altyapısı.
6. `writer.ts` — `anthropic.messages.stream()`'e geçiş, tool-use döngüsünü
   generator içine taşı.
7. `route.ts` — yeni ince orkestrasyon.
8. Client tarafı (`components/app/*draft*`): `fetch().json()` yerine stream
   okuyan bir hook'a geçiş (`useDraftStream`), chip UI bileşeni eklenmesi.

Geriye dönük uyumluluk: `POST /api/draft-proposal` aynı auth/kota/route
kalıyor, sadece response content-type `application/json` → `text/event-stream`
değişiyor — client güncellenmeden eski davranışı bekleyen hiçbir entegrasyon
yok (bu uç sadece kendi frontend'imizden çağrılıyor, `app/api/v1/*` dış API
ayrı ve bundan etkilenmiyor).

---

## 9. Neyin AYNI kaldığı (bilinçli olarak)

- Tüm Supabase tabloları/kolonları — **hiçbiri değişmiyor**.
- `draftTools`'un iş mantığı (`search_content_library`,
  `add_legal_block_to_proposal`, `add_text_block_from_library`,
  `generate_custom_text_block`) — deep-copy garantisi aynen korunuyor.
- Kota mantığı (`ai_usage.count` / `message_count`, plan limitleri).
- Dil kalitesi kuralları (TDK, "-eyim/-ayım" yasağı, okunabilirlik) —
  `prompts.ts` içinde, sadece daha küçük/odaklı parçalara bölünmüş halde.
- `resolveTemplateById`, `matchNamedTemplate`, `matchCompanyTemplateByName` —
  `orchestrator.ts`/`context.ts`'e taşınıyor, mantık değişmiyor.

Bu tasarımı onaylarsan, `app/api/draft-proposal/` altında dosya dosya
uygulamaya geçebilirim.
