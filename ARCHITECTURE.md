# SeelyDeal — Teknik Mimari Özeti

Bu dosya, uygulamayı başka bir YZ'ye/geliştiriciye tanıtmak için hazırlanmış kısa
bir mimari brifingdir: temel stack, veri modeli ve "hangi bilgi nereden geliyor,
nereye yazılıyor" akışı.

**Stack:** Next.js 16 (App Router, React 19) · Supabase (Postgres + Auth) ·
Anthropic Claude (`claude-sonnet-5`) · Tailwind v4

---

## 1. Veri modeli (`supabase/schema.sql` + `supabase/migrations/*`)

- **companies** — tek şirket = tek müşteri hesabı. `plan` (lite/pro/custom),
  `ai_monthly_limit`, marka alanları (`logo_url`, `primary_color`, `font`,
  `tagline`), `ai_instructions` (Seely'ye kalıcı talimat), `default_sections`
  (jsonb — her teklifte hangi bölümlerin varsayılan geleceği), SSO alanları,
  `onboarding_completed`.
- **profiles** — Supabase Auth kullanıcısını `company_id`'ye bağlar (1 şirkete
  N kullanıcı), `role` (owner/admin/member/viewer).
- **team_members** — teklifte görünen ekip üyeleri (isim/unvan/foto).
- **company_documents** — "İçerik Kütüphanesi": `type` (contract /
  proposal_template / service_description / other / content_block), serbest
  metin `content`. Seely buradan arama yapıp teklife kopya blok ekliyor.
- **clients** — şirketin kendi müşteri listesi.
- **proposals** — asıl teklif kaydı: `status` (draft/sent/viewed/accepted/
  declined), `sections`/`line_items`/`blocks` (jsonb), `contract_text`,
  `payment_link`, `signed_at`, e-imza/OTP alanları, görüntülenme (view)
  kayıtları.
- **templates** — şirketin kendi kaydettiği taslaklar (isim, sections,
  line_items, blocks, theme).
- **ai_usage** — company_id + month bazlı `count` (üretilen taslak) ve
  `message_count` (toplam mesaj) — plan kotası burada tutuluyor.
- **team_invites** — bekleyen davetler.

RLS: her tablo `company_id` üzerinden izole — bir şirket başka şirketin
verisini göremez.

---

## 2. Kayıt/giriş → onboarding → ilk veri toplama

- `/signup`, `/login` → Supabase Auth (demo modda gerçek Supabase yoksa
  bypass — bkz. CLAUDE.md "Auth" bölümü).
- İlk girişte `companies.onboarding_completed = false` ise `/onboarding`
  sihirbazına yönlenir (`components/app/onboarding-wizard.tsx`, 4 adım):
  1. Şirket adı, kişi adı/unvanı, web sitesi, e-posta, telefon, konum, slogan
  2. Sektör + ekip büyüklüğü + varsayılan bölüm tercihleri (8 bölümlük
     katalogdan hangileri her teklifte otomatik gelsin)
  3. Hizmet/fiyatlandırma serbest metni + varsa örnek teklif dosyası yükleme
  4. Logo/marka rengi + Seely'ye kalıcı davranış talimatı
- Bu veriler `companies`, `team_members`, `company_documents`,
  `company.ai_instructions` alanlarına yazılır (`app/api/settings/onboarding`).

---

## 3. AI teklif taslağı akışı (`app/api/draft-proposal/route.ts`)

1. İstek: sohbet mesajları + varsa mevcut taslak (`currentDraft`) + template id
   + dosya ekleri + (opsiyonel) website URL.
2. Sunucu paralel olarak Supabase'den çekiyor: `companies`, `team_members`,
   `company_documents`, `user_defaults`, kullanıcının son 2 teklifi,
   `templates`.
3. Bunlardan tek bir **sistem promptu** kuruluyor (Seely'nin kimliği + dil
   kalitesi kuralları + soru sırası + şirketin gerçek verisi).
4. Anthropic'e tool-use ile çağrı yapılıyor (max 4 tur):
   - `search_content_library` — İçerik Kütüphanesi'nde canlı arama
   - `add_legal_block_to_proposal` — kütüphanedeki sözleşmeyi teklife bağımsız
     "Legal" blok olarak kopyalar
   - `add_text_block_from_library` — kütüphanedeki hizmet açıklamasını teklife
     bağımsız metin bloğu olarak kopyalar
   - `generate_custom_text_block` — kütüphanede uygun doküman yoksa modelin
     kendi yazdığı içerikten blok üretir
   Hiçbiri kaynak `company_documents` satırını değiştirmez, sadece deep-copy
   blok üretir.
5. Modelin serbest metin cevabından fenced-block'lar regex ile ayrıştırılıyor:
   ` ```json``` ` (taslağın kendisi), ` ```brand``` `, ` ```instruction``` `,
   ` ```onboarding``` `, ` ```format``` `, ` ```userDefault``` `,
   ` ```addClient``` `. Bunlar temizlenip düz metin `reply` olarak, geri kalanı
   ayrı JSON alanları olarak client'a dönüyor.
6. Client bu alanları ilgili yerlere uyguluyor: taslak → önizleme paneli,
   `brand` → marka profili, `instruction` → `ai_instructions`, `format` →
   kullanıcı varsayılanı, `addClient` → `clients` tablosu.
7. `ai_usage` her turda güncelleniyor; `count >= ai_monthly_limit` veya
   `message_count >= messageLimit` olduğunda 429 dönülüyor.

---

## 4. Teklif yaşam döngüsü

- Taslak onaylanınca (`confirmed: true`) `POST /api/proposals` ile
  `proposals` tablosuna otomatik kaydediliyor.
- Gönderilen teklif `/p/[id]` genel (auth'suz) sayfasında açılıyor —
  görüntüleme kaydediliyor (view timeline), OTP ile e-imza akışı çalışıyor
  (Legal / ContractSignOff blokları üzerinden).
- `app/api/v1/*` — Custom plan için dış API erişimi (kendi API key'iyle
  proposals/clients CRUD).
- `app/api/reports/proposals` — analitik/rapor uçları.

---

## 5. Marka/konfig kaynağı

- `app.config.ts` — tek doğruluk kaynağı: marka adı, navigasyon
  (`navGroups`), fiyatlandırma (`pricing`), entegrasyon listesi (Supabase /
  Dropbox Sign / Stripe / Anthropic). UI bunu okuyor, hardcode yok.
- `lib/demo/data.ts` — Supabase bağlı değilse (demo mod) uygulamanın çalıştığı
  sahte veri kaynağı (gerçekçi teklifler, müşteriler, view timeline'ları).
- Her kullanıcıya görünen string `{ tr, en }` biçiminde — çift dilli, ortak
  UI metinleri `lib/i18n/dict.ts`'de, varsayılan dil `lib/i18n/config.ts`'de.

---

## Klasör haritası (özet)

```
app/(app)/…          Dashboard, proposals, clients, templates, content, settings vb. (auth'lı ekranlar)
app/(auth)/…          /login, /signup
app/(marketing)/…     Pazarlama sayfası, /privacy, /terms
app/(demo)/demo        Canlı demo modu
app/onboarding         4 adımlı kurulum sihirbazı
app/p/[id]             Genel (auth'suz) teklif görüntüleme + e-imza sayfası
app/api/draft-proposal AI teklif yazım motoru (Seely)
app/api/proposals       Teklif CRUD
app/api/company-documents  İçerik Kütüphanesi CRUD
app/api/settings/…     Marka, ekip, entegrasyon, hesap ayarları
app/api/v1/…            Dış API (Custom plan)
lib/supabase/           Supabase client'ları (server/browser/service role)
lib/demo/data.ts         Demo mod veri kaynağı
lib/proposal-blocks/     Blok tipleri + legacy dönüştürme + kütüphaneden blok üretme
supabase/schema.sql      Taban şema
supabase/migrations/     Şemaya sonradan eklenen her alan/tablo
```
