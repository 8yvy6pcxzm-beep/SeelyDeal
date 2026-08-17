# SeelyDeal — Taslak Teklif Şablonları Mimarisi

Bu doküman, `lib/demo/data.ts` içindeki `templates` dizisine yeni bir "taslak teklif
örneği" (draft template) eklemek isteyen biri (veya bir AI asistan) için hazırlandı.
Amaç: yeni bir sektöre özel örnek teklif metnini, projenin kullandığı veri şekline
doğru şekilde dönüştürmek.

## 1. Büyük resim: iki tür şablon var

`lib/demo/data.ts` içindeki `Template` tipi tek bir arayüzü paylaşır, ama iki farklı
amaçla kullanılır (`kind` alanıyla ayrılır):

- **`kind` yok (undefined) → Görsel şablon.** Sadece bir tasarım iskeleti. İçindeki
  `sections` metni AI tarafından asla kullanılmaz, sadece `theme` (renk/font) alınır.
  Örnek: `t1`–`t4`.
- **`kind: "draft"` → Taslak teklif örneği.** Gerçek, kullanılabilir bir teklif
  metnidir. Kullanıcı "Bu şablonla yaz" dediğinde bu şablonun `introText`,
  `aboutText`, `sections`, `lineItems`, `contractText` alanları gerçek bir teklife
  (proposal) kopyalanır ve editörde düzenlenebilir hale gelir.

**Biz her zaman `kind: "draft"` ekliyoruz.** Görsel şablonlarla işimiz yok.

## 2. `Template` tipi (draft şablonlar için doldurulacak alanlar)

```ts
interface Template {
  id: string;                 // benzersiz, "t12", "t13" gibi artan id
  name: L;                    // { tr: "...", en: "..." } — şablonun görünen adı
  category: L;                // { tr: "...", en: "..." } — kategori etiketi
  uses: 0;                    // draft şablonlarda hep 0
  winRate: 0;                 // draft şablonlarda hep 0
  accent: string;             // "var(--seg-1)" ... "var(--seg-4)" arasında rotasyonlu
  kind: "draft";              // sabit
  sector: "construction" | "software" | "events" | "consulting" | "general" | "accounting" | <yeni sektör>;
  theme?: { primaryColor: string; accentColor: string; font?: string }; // opsiyonel, genelde atlanır

  introText: L;               // Ön yazı / cover letter — HeroCover bloğuna gider
  aboutText: L;                // Hakkımızda — RichSection benzeri, ama ayrı bir alan
  sections: TemplateSection[]; // Diğer tüm içerik bölümleri (ekip, kapsam, süreç, vb.)
  lineItems: { name: L; qty: number; unit: number }[]; // Fiyatlandırma kalemleri
  contractText: L;            // Sözleşme/şartlar metni — ContractSignOff bloğuna gider
}

interface TemplateSection {
  title: L;   // { tr: "...", en: "..." }
  body: L;    // { tr: "...", en: "..." } — \n ile paragraf/madde ayrımı, • ile bullet
}

type L = { tr: string; en: string }; // HER metin alanı hem TR hem EN olmalı
```

**Önemli kurallar:**
- Her metin alanı `{ tr, en }` şeklinde iki dilli olmalı. Tek dil asla yeterli değil.
- `body` metinlerinde paragraf ayrımı için `\n\n`, madde listesi için `• ` (bullet)
  ve `\n` kullanılır — düz metin, HTML değil.
- Bilinmeyen/kişiye özel veriler (isim, tarih, tutar vb.) `[Köşeli parantez]` içinde
  placeholder olarak yazılır — örn. `[Müşteri Yetkilisi]`, `[X] yıl`.
- `lineItems[].name` de `L` tipinde (iki dilli), `qty` ve `unit` sayısaldır
  (`unit` = birim fiyat, TL varsayımıyla).

## 3. Bu ham veri, arka planda "blok" mimarisine nasıl dönüşüyor?

Gerçek teklif sayfası, blok tabanlı bir render motoru kullanır
(`lib/types/proposal-blocks.ts` + `components/app/blocks/block-renderer.tsx`).
Blok tipleri şunlardır:

| Blok tipi        | Ne işe yarar |
|-------------------|--------------|
| `HeroCover`       | Kapak/ön yazı — proposal'ın genel bilgilerinden + `introText`'ten oluşur |
| `RichSection`      | Tek bir başlık+metin bölümü (tekrar edebilir, sıralanabilir) |
| `PricingTable`     | Fiyatlandırma tablosu — proposal'ın `lineItems`'ından otomatik oluşur |
| `ContractSignOff`  | Sözleşme metni + imza alanı |
| `Legal`            | Ayrı, imza zorunluluğu olabilen hukuki metin bloğu (opsiyonel, draft şablonlarda kullanılmıyor) |

Şablonumuzdaki düz alanlar (`sections`, `lineItems`, `contractText`), kullanıcı
şablonu proposal'a çevirdiğinde `lib/proposal-blocks/convert-legacy.ts` tarafından
**otomatik olarak** bloklara dönüştürülür:

```
introText/aboutText  →  (proposal başlığı ile birlikte) HeroCover
sections[i]           →  RichSection (id: "section-i", label: title, body: body)
lineItems (varsa)     →  PricingTable
contractText (varsa)  →  ContractSignOff (contractText: metin)
```

Yani **biz blokları elle yazmıyoruz** — sadece `Template` alanlarını doğru
doldurmamız yeterli, dönüşüm otomatik.

## 4. Yeni bir şablon eklerken izlenecek adımlar

1. `lib/demo/data.ts` içinde `Template.sector` union tipine yeni sektörü ekle
   (örn. `"legal"`, `"medical"` gibi), satır ~414.
2. `templates: Template[]` dizisinin sonuna yeni bir obje ekle (`id` artan: `t13`,
   `t14`, ...), yukarıdaki şemaya birebir uyarak.
3. Kaynak İngilizce/Türkçe metni şu 5 bölüme ayır ve eşleştir:
   - **Ön yazı / cover letter** → `introText`
   - **Hakkımızda / firma tanıtımı** → `aboutText`
   - **Diğer her şey** (ekip, proje özeti, hizmet kapsamı, süreç, sonraki adımlar,
     iletişim vb.) → `sections[]` içinde ayrı ayrı `{ title, body }` blokları.
     Her biri kendi başlığıyla ayrı bir bölüm olmalı — birleştirilmemeli.
   - **Fiyatlandırma kalemleri** → `lineItems[]`
   - **Sözleşme/şartlar/hukuki metin** → `contractText`
4. `components/app/ai-draft-dialog.tsx` içindeki `SECTOR_CHIPS` dizisine yeni bir
   emoji + sektör satırı ekle (satır ~258 civarı), Seely'nin AI taslak diyaloğunda
   sektör chip'i olarak görünmesi için:
   ```ts
   { emoji: "🩺", tr: "Sağlık", en: "Healthcare", templateId: demoTemplates.find((t) => t.sector === "medical")?.id },
   ```
5. `npx tsc --noEmit` ile tip kontrolü yap.

## 5. Sınırlamalar / bilinmesi gerekenler

- Bu şablonlar **sadece demo/marka-tanıtım verisidir** — gerçek şirketlere özel bir
  veritabanı kaydı değildir. Gerçek `templates` tablosu (Supabase) ayrı bir sistemdir
  ve sadece `POST /api/templates` runtime çağrısıyla (kullanıcı arayüzünden) doldurulur;
  bunun için bir seed script yoktur.
- `Legal`, `Contact` gibi ayrı bir blok tipi **yoktur** — iletişim bilgisi normal bir
  `RichSection` olarak eklenir (örn. başlık: "İletişim Bilgileri").
- Var olan örnekler (`t5` inşaat, `t9` danışmanlık, `t11` etkinlik, `t12` muhasebe)
  bu dosyada — üslup ve uzunluk için onlara bak, tutarlı kal.
