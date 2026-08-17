# İçerik Kütüphanesi (Content Library) — Mimari Raporu

## Nedir?

SeelyDeal'de her şirketin kendi teklif dokümanlarını (sözleşme şablonları, hizmet
açıklamaları, hazır metin blokları) sakladığı; hem manuel olarak tekliflere
eklenebilen hem de Seely AI'nın kendisinin "arayıp bulup" teklife dahil edebildiği
bir doküman deposu. **Pro/Custom plan** özelliği — Lite planda kilitli.

## Dosya Haritası

### Sayfa / UI
- `app/(app)/content/page.tsx` — gerçek sayfa, `planAllows(plan, "document_library")`
  kontrolü, kilitliyse upsell kartı
- `app/(demo)/demo/content/page.tsx` — demo modda gerçek içerik yok, sadece
  `/demo/team`'e redirect eden stub
- `components/app/content-library-client.tsx` (419 satır) — asıl grid UI +
  önizleme modalı
- `components/app/personal-default-card.tsx` — sayfanın üstünde ayrı bir
  "kişisel varsayılan" kartı
- `components/app/ai-draft-dialog.tsx` — "Kütüphaneme ekle" aksiyonu
  (`/api/company-documents`'a POST)
- `components/app/nav-groups.tsx` — `"/content": "document_library"` (nav gating)

### API
- `POST /api/company-documents` — AI taslak diyaloğundaki "Kütüphaneme ekle"
  için, bir bloğu `content_block` olarak kaydeder
- `POST /api/company-documents/upload` — PDF/DOCX yükleme, metni çıkarma
  (`pdf-parse`/`mammoth`), orijinal dosyayı private storage'a koyma; **kod
  içinde plan kontrolü var**, 20MB limit
- `GET /api/company-documents/[id]/preview` — orijinal dosya için 120sn'lik
  signed URL

Diğer CRUD (yeni belge, güncelleme, silme, varsayılan şablon yapma) API route'u
olmadan **doğrudan client'tan Supabase'e** yapılıyor, güvenliği RLS policy'leri
sağlıyor.

### AI Tool Entegrasyonu (draft-proposal pipeline)
- `app/api/draft-proposal/tools.ts` — 4 content-library AI tool'u +
  `runContentLibraryTool`
- `app/api/draft-proposal/writer.ts` — tool'ları streaming tool-use loop'una bağlar
- `app/api/draft-proposal/route.ts` — `plan`'ı `streamDraft`'a geçirir
- `app/api/draft-proposal/context.ts`, `prompts.ts`, `planner.ts`,
  `orchestrator.ts` — prompt/orkestrasyon bağlamında kütüphaneye referans verir
- `app/api/draft-proposal/tools.test.ts` — testler
- `lib/proposal-blocks/legal-block.ts` — `createLegalBlockFromDocument`
- `lib/proposal-blocks/text-block.ts` — `createTextBlockFromDocument`

### Plan gating
- `lib/plan.ts` — `document_library` gated özellik, min plan `pro`
- `app.config.ts:201` — nav girişi `{ label: "Content library", href: "/content", icon: "library" }`

### Supabase şema/migration
- `supabase/schema.sql:36-44` temel tablo, `:147` RLS policy
- `supabase/migrations/20260726090000_add_document_default_template.sql`
- `supabase/migrations/20260802173000_gate_document_library_by_plan.sql`
- `supabase/migrations/20260802181000_fix_document_library_gate_plan_name.sql`
- `supabase/migrations/20260810000000_add_content_block_doc_type.sql`
- `supabase/migrations/20260810020000_add_document_file_storage.sql`

## Veri Modeli (`company_documents` tablosu)

```sql
create table company_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  type text not null check (type in (
    'contract', 'proposal_template', 'service_description', 'other', 'content_block'
  )),
  title text not null,
  content text not null,
  is_default_template boolean not null default false,
  file_path text,
  file_mime text,
  file_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

`content_block` tipi = SeelyDeal'in "hazır içerik" önerileri; diğerleri
kullanıcının kendi yüklediği belgeler.

Client-side TS tipi (`content-library-client.tsx:12-21`):

```ts
type CompanyDocument = {
  id: string;
  type: "contract" | "proposal_template" | "service_description" | "other" | "content_block";
  title: string;
  content: string;
  is_default_template: boolean;
  file_path?: string | null;
  file_mime?: string | null;
  file_name?: string | null;
};
```

## Sayfa Yapısı / UI Akışı

`ContentLibraryClient`:
- Supabase user → profile → `company_id` çözümü, ardından `company_documents`
  doğrudan client'tan sorgulanır
- Belgeler `ownDocs` (type != content_block) ve `readyContent` (type ==
  content_block, "Hazır İçerikler" bölümü) olarak ikiye ayrılır
- Üstte `PersonalDefaultCard`
- "Hazır içerikler" grid'i (varsa)
- "Teklif örnekleriniz" kartı — iOS ana ekranı stilinde app-icon tile grid'i,
  Upload/Add butonları, varsayılan şablon için yıldız rozeti
- Tile'a tıklayınca `DocumentPreviewModal` açılır: orijinal dosya önizlemesi
  (PDF iframe, DOCX indirme), inline düzenlenebilir başlık, tip seçici,
  "varsayılan yap" butonu (yalnızca proposal_template için), AI-okur metni
  gösterme/düzenleme toggle'ı, silme butonu
- CRUD doğrudan Supabase'e: `addDocument`, `persistDocument`, `removeDocument`,
  `makeDefaultTemplate`; `uploadDocument` ise `/api/company-documents/upload`'a POST

## AI Entegrasyonu (Seely'nin kütüphaneyi kullanması)

`app/api/draft-proposal/tools.ts` içinde 4 AI tool tanımlı:

1. **`search_content_library`** — kütüphanede RAG arama (tip/sorguya göre
   filtrelenebilir), bozuk onboarding verisini `isSeelyDealPricingLeak` ile
   ayıklar, en fazla 10 sonuç + 200 karakter önizleme döner
2. **`add_legal_block_to_proposal`** — `contract` tipindeki bir belgeyi
   teklife bağımsız "Legal" blok olarak kopyalar (`createLegalBlockFromDocument`
   ile deep copy, kaynak değişmez)
3. **`add_text_block_from_library`** — `service_description`/`content_block`/
   `other` belgeyi "RichSection" blok olarak kopyalar
   (`createTextBlockFromDocument`)
4. **`generate_custom_text_block`** — AI'nın kendi ürettiği metin;
   `company_documents`'a hiç dokunmadığı için **kasıtlı olarak gate'siz**

### Commit `67d13d6` — Plan gate açığı + race condition düzeltmesi

**Plan gate açığı**: UI `/content` sayfasını Pro+ ile kilitliyordu ama AI chat
tool path'inde sunucu tarafı kontrol yoktu — Lite kullanıcı Seely'ye
"kütüphaneden ekle" diyerek UI kısıtlamasını bypass edebiliyordu.

`tools.ts:83, 90, 98-102`:

```ts
const LIBRARY_GATED_TOOLS = new Set([
  "search_content_library",
  "add_legal_block_to_proposal",
  "add_text_block_from_library",
]);

export async function runContentLibraryTool(
  name, input, service, companyId,
  plan: "lite" | "pro" | "custom",
  pendingLegalBlocks, pendingContentBlocks
) {
  if (LIBRARY_GATED_TOOLS.has(name) && !planAllows(plan, "document_library")) {
    return JSON.stringify({
      error: "İçerik Kütüphanesi Pro ve Custom paketlerinde kullanılabilir. Bu şirket Lite planda — kullanıcıya yükseltmesi gerektiğini söyle, kütüphaneden bir şey ekleyemezsin.",
    });
  }
  ...
}
```

`plan`, `route.ts:159` (`plan: core.company?.plan ?? "lite"`) → `writer.ts` →
`runContentLibraryTool` şeklinde iletiliyor.

**Race condition (aynı commit'te)**: `writer.ts`'deki tool-execution loop tüm
`tool_use` çağrılarını `Promise.all` ile paralel çalıştırıyor. `emit_draft`
senkron (await yok), `add_legal_block_to_proposal`/`add_text_block_from_library`
ise asenkron (DB round-trip). İkisi aynı turda çağrıldığında `emit_draft`,
`pendingLegalBlocks`/`pendingContentBlocks`'a henüz push edilmemişken bunları
okuyabiliyordu — doğru plan olsa bile kütüphaneden eklenen bloklar sessizce
düşüyordu. **Çözüm**: blok birleştirme artık tüm `Promise.all` batch'i tamamen
bitene kadar erteleniyor; `toolResults` üzerinde iterasyonla her `draft`
event'inin `blocks` alanına en son halde birleştiriliyor.

## Demo Mod Farkı

`lib/demo/data.ts` içinde content-library verisi **hiç yok** (grep: 0 eşleşme
`company_documents`, `content_block`, `CompanyDocument` için). `/demo/content`
sadece `/demo/team`'e yönlendiren bir client-side redirect stub'u — diğer demo
sayfalarının aksine burada fixture yok, gerçek bir demo deneyimi yok.

## Supabase Şema / RLS Geçmişi

1. `schema.sql:147` — orijinal blanket policy:
   `create policy "own documents" on company_documents for all using (company_id = auth_company_id());`
2. `20260802173000_gate_document_library_by_plan.sql` — read/update/delete/insert
   olarak ayrıldı; insert policy'ye plan kontrolü eklendi:
   `and (select plan from companies where id = company_id) <> 'starter'`
3. `20260802181000_fix_document_library_gate_plan_name.sql` — sonradan
   çalışan bir "starter"→"lite" rename migration'ı yüzünden plan adı
   kaymıştı, `<> 'lite'` olarak düzeltildi
4. `20260810000000_add_content_block_doc_type.sql` — `type` check
   constraint'ine `'content_block'` eklendi
5. `20260810020000_add_document_file_storage.sql` — `file_path`/`file_mime`/
   `file_name` kolonları, private `company-documents` storage bucket'ı +
   4 policy (`(storage.foldername(name))[1] = auth_company_id()::text`
   scope'lu)
6. `20260726090000_add_document_default_template.sql` — `is_default_template`
   boolean'ı

Not: Plan gate'i veritabanı **insert** seviyesinde de zorlanıyor (defense in
depth) — UI, upload API'si ve AI tool'larındaki app-layer kontrollerden
bağımsız bir katman.

## Özet: 4 Katmanlı Plan-Gating Mimarisi

1. **UI** — `/content` sayfası `planAllows` ile kilitli
2. **Upload API** — `/api/company-documents/upload` route'unda kod içi kontrol
3. **AI tool katmanı** — `runContentLibraryTool` içinde (commit `67d13d6` ile eklendi)
4. **Veritabanı RLS** — insert policy'de plan kontrolü

Bugünkü commit, AI tool katmanındaki eksik gate'i ve ona bağlı bir race
condition'ı kapattı.
