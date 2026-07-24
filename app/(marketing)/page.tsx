"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  Minus,
  Plus,
  Quote,
  Star,
  Eye,
  PenLine,
  Sparkles,
  Send,
  FileSignature,
  MousePointerClick,
  Clock,
  Smartphone,
  Monitor,
} from "lucide-react";
import appConfig from "@/app.config";
import { Icon } from "@/components/ui/icon";
import { SignDemo } from "@/components/marketing/sign-demo";
import { DemoRequestDialog } from "@/components/marketing/demo-request-dialog";
import { ProductPreview, CompanyMark } from "@/components/marketing/marks";
import { useLang } from "@/components/i18n/language-provider";
import { cn } from "@/lib/utils";
import type { L } from "@/lib/i18n/config";

/* ─────────────────────────────────────────────────────────────────────────────
   Local bilingual copy that doesn't belong in app.config.ts. Everything here is
   { tr, en } and resolved through the active language via tt().
   ───────────────────────────────────────────────────────────────────────────── */

const HERO_BENEFITS: L[] = [
  { tr: "AI ilk taslağı dakikalar içinde yazar — sen son rötuşu yaparsın", en: "AI writes the first draft in minutes — you do the final polish" },
  { tr: "Etkileşimli fiyat tablosu, müşteri seçince toplamı canlı günceller", en: "Interactive pricing recomputes live as your client picks options" },
  { tr: "Her görüntülenmeyi izle, müşterin tek tıkla imzalasın", en: "Track every view; your client signs in one click" },
];

const TRUSTED = ["Northwind", "Parable", "Formwork", "Cedarworks", "Lumen", "Harvest", "Brightline", "Meridian"];

const HOW_STEPS: { n: string; icon: string; title: L; body: L }[] = [
  {
    n: "01",
    icon: "layout-template",
    title: { tr: "Şablon seç", en: "Pick a template" },
    body: { tr: "Onaylı, markaya uygun bir şablondan başla. Boş sayfa yok — en iyi işinden başla.", en: "Start from an on-brand, approved template. No blank page — begin from your best work." },
  },
  {
    n: "02",
    icon: "sparkles",
    title: { tr: "AI taslak yazsın", en: "AI drafts it" },
    body: { tr: "Kısa bir brief gir; AI kapak, kapsam, fiyatlandırma ve şartları markanın sesiyle yazar.", en: "Enter a short brief; AI writes the cover, scope, pricing and terms in your brand voice." },
  },
  {
    n: "03",
    icon: "send",
    title: { tr: "Gönder", en: "Send" },
    body: { tr: "Güzel, etkileşimli bir bağlantı gönder. PDF eki yok, indirme yok.", en: "Send a gorgeous, interactive link. No PDF attachment, no download." },
  },
  {
    n: "04",
    icon: "eye",
    title: { tr: "İzle", en: "Track" },
    body: { tr: "Açılışları, hangi bölümde ne kadar kalındığını gör. Tam doğru anda takip et.", en: "See opens and time-on-section. Follow up at the perfect moment." },
  },
  {
    n: "05",
    icon: "pen-line",
    title: { tr: "İmzala", en: "Sign" },
    body: { tr: "Müşterin tek tıkla imzalar; kabul edilen tutar anında tahsil edilebilir.", en: "Your client signs in one click; the accepted amount can be charged instantly." },
  },
];

type CompareValue = boolean | L | string;
const COMPARE: { feature: L; word: CompareValue; generic: CompareValue; tender: CompareValue }[] = [
  { feature: { tr: "AI taslak yazımı", en: "AI drafting" }, word: false, generic: { tr: "Eklenti", en: "Add-on" }, tender: true },
  { feature: { tr: "Etkileşimli fiyat tablosu", en: "Interactive pricing" }, word: false, generic: { tr: "Sınırlı", en: "Limited" }, tender: true },
  { feature: { tr: "Görüntüleme takibi", en: "View tracking" }, word: false, generic: { tr: "Kısmi", en: "Partial" }, tender: true },
  { feature: { tr: "Yerleşik e-imza", en: "Built-in e-signature" }, word: { tr: "Ayrı araç", en: "Separate tool" }, generic: true, tender: true },
  { feature: { tr: "Şablon kütüphanesi", en: "Template library" }, word: { tr: "Manuel", en: "Manual" }, generic: true, tender: true },
  { feature: { tr: "Mobilde güzel görünür", en: "Beautiful on mobile" }, word: false, generic: { tr: "Değişken", en: "Varies" }, tender: true },
  { feature: { tr: "İmzada anında ödeme", en: "Pay on signature" }, word: false, generic: false, tender: true },
];

const TESTIMONIALS: { quote: L; name: string; role: L; initials: string; metric: L }[] = [
  { quote: { tr: "Teklif yazma süremiz yarıdan fazla düştü ve teklifler bambaşka görünüyor. Kazanma oranımız %35 arttı.", en: "Our proposal time dropped by more than half and they look stunning. Our win rate is up 35%." }, name: "Maria Gomez", role: { tr: "Kurucu · Northwind", en: "Founder · Northwind" }, initials: "MG", metric: { tr: "kazanma +%35", en: "win rate +35%" } },
  { quote: { tr: "Bir teklifin ne zaman açıldığını görmek oyunu değiştirdi. Müşteri fiyatlandırmaya bakarken arıyoruz.", en: "Seeing exactly when a proposal is opened changed the game. We call while they're on the pricing page." }, name: "Liam Chen", role: { tr: "Satış Lideri · Parable", en: "Sales Lead · Parable" }, initials: "LC", metric: { tr: "2× yanıt oranı", en: "2× reply rate" } },
  { quote: { tr: "Müşteriler artık PDF indirmiyor — bağlantıyı açıp tek tıkla imzalıyor. Sürtünme sıfır.", en: "Clients no longer download PDFs — they open the link and sign in one click. Zero friction." }, name: "Nadia Park", role: { tr: "Operasyon · Formwork", en: "Ops · Formwork" }, initials: "NP", metric: { tr: "1 tıkla imza", en: "1-click sign" } },
  { quote: { tr: "AI taslağı işin %80'ini yapıyor; biz sadece sesi ayarlıyoruz. İlk teklif aynı gün gidiyor.", en: "The AI draft does 80% of the work; we just tune the voice. First proposal goes out same day." }, name: "Tom Reilly", role: { tr: "Ajans Sahibi · Cedarworks", en: "Agency Owner · Cedarworks" }, initials: "TR", metric: { tr: "4× daha hızlı", en: "4× faster" } },
  { quote: { tr: "Etkileşimli fiyat tablosu ortalama anlaşma büyüklüğümüzü artırdı — müşteriler ek paketleri kendileri ekliyor.", en: "The interactive pricing lifted our average deal size — clients add upsells themselves." }, name: "Aisha Khan", role: { tr: "CEO · Lumen", en: "CEO · Lumen" }, initials: "AK", metric: { tr: "anlaşma +%22", en: "deal size +22%" } },
  { quote: { tr: "Analitik panosu hangi şablonun kapandığını gösteriyor. Artık tahmin etmiyoruz, ölçüyoruz.", en: "The analytics show which template closes. We don't guess anymore, we measure." }, name: "Diego Santos", role: { tr: "Gelir · Harvest", en: "Revenue · Harvest" }, initials: "DS", metric: { tr: "%47 kazanma", en: "47% win rate" } },
];

/* Who SeelyDeal is for — use-case cards. */
const USE_CASES: { icon: string; title: L; body: L }[] = [
  { icon: "palette", title: { tr: "Ajanslar & stüdyolar", en: "Agencies & studios" }, body: { tr: "Markaya uygun, etkileşimli teklifleri dakikalar içinde gönder; her görüntülenmeyi izle.", en: "Send on-brand, interactive proposals in minutes and track every view." } },
  { icon: "code", title: { tr: "Yazılım & danışmanlık", en: "Software & consulting" }, body: { tr: "Kapsam, kilometre taşları ve fiyatlandırmayı tek bir imzalanabilir belgede topla.", en: "Bundle scope, milestones and pricing into one signable document." } },
  { icon: "briefcase", title: { tr: "Freelancer'lar", en: "Freelancers" }, body: { tr: "Profesyonel teklifler hazırla, tek tıkla imza al ve imzada ödemeyi tahsil et.", en: "Look pro, get one-click signatures, and collect payment on signature." } },
  { icon: "building-2", title: { tr: "Satış ekipleri", en: "Sales teams" }, body: { tr: "Onay akışları, CRM senkronu ve kazanma oranı analitiği ile ölçekle.", en: "Scale with approval flows, CRM sync, and win-rate analytics." } },
];

/* Deep-dive feature blocks (alternating). */
const DEEP_DIVE: { eyebrow: L; title: L; body: L; points: L[]; reverse?: boolean; panel: "ai" | "pricing" | "track" }[] = [
  {
    eyebrow: { tr: "AI yazımı", en: "AI drafting" },
    title: { tr: "Boş sayfa yok, sadece harika ilk taslaklar", en: "No blank page, just great first drafts" },
    body: { tr: "Birkaç satırlık brief'ten kapak, kapsam, fiyatlandırma ve şartları markanın sesiyle yazar. Tonu ve uzunluğu sen ayarlarsın.", en: "From a few lines of brief, it writes the cover, scope, pricing and terms in your brand voice. You tune the tone and length." },
    points: [
      { tr: "Marka sesi & ton kontrolü", en: "Brand-voice & tone control" },
      { tr: "Bölüm bölüm yeniden yazım", en: "Section-by-section rewrites" },
      { tr: "Geçmiş kazanan tekliflerden öğrenir", en: "Learns from your past winners" },
    ],
    panel: "ai",
  },
  {
    eyebrow: { tr: "Etkileşimli fiyatlandırma", en: "Interactive pricing" },
    title: { tr: "Müşteri kendi paketini kurar", en: "Clients build their own package" },
    body: { tr: "Opsiyonel kalemler, adet seçimi ve katmanlı paketler — toplam canlı güncellenir. Kabul edilen tutar doğrudan Stripe ile tahsil edilir.", en: "Optional line items, quantity pickers and tiered packages — the total recomputes live. The accepted amount charges straight through Stripe." },
    points: [
      { tr: "Aç/kapat kalemler & adetler", en: "Toggle items & quantities" },
      { tr: "Katmanlı & tekrarlayan paketler", en: "Tiered & recurring packages" },
      { tr: "İmzada Stripe ile ödeme", en: "Pay via Stripe on signature" },
    ],
    reverse: true,
    panel: "pricing",
  },
  {
    eyebrow: { tr: "Görüntüleme takibi", en: "View tracking" },
    title: { tr: "Tam doğru anda takip et", en: "Follow up at the perfect moment" },
    body: { tr: "Teklifin ne zaman açıldığını, hangi bölümde ne kadar kalındığını ve kimin baktığını gör. Görüntülendi-ama-imzalanmadı uyarıları gelsin.", en: "See when a proposal opens, time-on-section, and who's viewing. Get viewed-but-not-signed alerts." },
    points: [
      { tr: "Bölüm bazlı süre takibi", en: "Time-on-section tracking" },
      { tr: "Açılışta gerçek zamanlı bildirim", en: "Real-time open notifications" },
      { tr: "Otomatik hatırlatma dizileri", en: "Automated reminder sequences" },
    ],
    panel: "track",
  },
];

/* Integration logos for the strip. */
const INTEGRATIONS: { name: string; glyph: "db" | "sign" | "pay" | "ai" }[] = [
  { name: "Supabase", glyph: "db" },
  { name: "Dropbox Sign", glyph: "sign" },
  { name: "Stripe", glyph: "pay" },
  { name: "Anthropic", glyph: "ai" },
];

export default function LandingPage() {
  const { t, lang } = useLang();
  const m = appConfig.marketing;
  const tt = (v: L) => v[lang];
  const [annual, setAnnual] = useState(true);
  const [demoTier, setDemoTier] = useState<string | null>(null);

  const sectionCopy = {
    demoTitle: { tr: "Müşteri gibi dene", en: "Try it like a client" } as L,
    demoSub: { tr: "Seçenekleri aç/kapat, adetleri ayarla; toplam canlı güncellensin. Sonra kabul et ve imzayı izle.", en: "Toggle options, adjust quantities, watch the total update live. Then accept and watch the signature animate in." } as L,
    featuresTitle: { tr: "Kazanan teklifler için ihtiyacın olan her şey", en: "Everything you need to win proposals" } as L,
    featuresSub: { tr: "Taslaktan imzaya, takipten ödemeye — tek panel.", en: "From draft to signature, tracking to payment — in one panel." } as L,
    howTitle: { tr: "Beş adımda kapanan teklif", en: "A closed deal in five steps" } as L,
    howSub: { tr: "Şablon seç, AI yazsın, gönder, izle, imzala.", en: "Pick a template, let AI draft, send, track, sign." } as L,
    useCasesTitle: { tr: "SeelyDeal kimler için?", en: "Who SeelyDeal is for" } as L,
    useCasesSub: { tr: "Teklif gönderen her ekip için güzel bir akış.", en: "A beautiful flow for every team that sends proposals." } as L,
    deepTitle: { tr: "Taslaktan imzaya", en: "From draft to signature" } as L,
    deepSub: { tr: "Üç katman, tek panel: yaz, fiyatla, izle ve kapat.", en: "Three layers, one panel: draft, price, track and close." } as L,
    trackTitle: { tr: "Teklifin gözlerinin önünde açılıyor", en: "Watch your proposal open in real time" } as L,
    trackSub: { tr: "Kim açtı, hangi bölümde ne kadar kaldı, hangi cihazdan — hepsi canlı.", en: "Who opened it, time on each section, on what device — all live." } as L,
    integrationsTitle: { tr: "Sevdiğin araçlarla çalışır", en: "Works with the tools you love" } as L,
    integrationsSub: { tr: "Supabase, Dropbox Sign, Stripe ve Anthropic'i dakikalar içinde bağla.", en: "Wire Supabase, Dropbox Sign, Stripe and Anthropic in minutes." } as L,
    compareTitle: { tr: "Neden SeelyDeal?", en: "Why SeelyDeal?" } as L,
    compareSub: { tr: "Word/PDF ve genel araçlarla karşılaştır.", en: "Compared to Word/PDF and generic tools." } as L,
    testimonialsTitle: { tr: "Satış ekipleri SeelyDeal'ı seviyor", en: "Sales teams love SeelyDeal" } as L,
    testimonialsSub: { tr: "Daha hızlı, daha güzel teklif gönderen ekiplerden.", en: "From teams sending faster, more beautiful proposals." } as L,
    pricingTitle: { tr: "Basit, koltuk-bazlı fiyatlandırma", en: "Simple, seat-based pricing" } as L,
    pricingSub: { tr: "İçerikle başla, otomasyonla büyüt.", en: "Start with content and scale with automation." } as L,
    popular: { tr: "En popüler", en: "Most popular" } as L,
    billingMonthly: { tr: "Aylık", en: "Monthly" } as L,
    billingAnnual: { tr: "Yıllık", en: "Annual" } as L,
    billingSave: { tr: "%36 tasarruf", en: "Save 36%" } as L,
    annualOnlyNote: { tr: "Sadece yıllık faturalandırma", en: "Annual billing only" } as L,
    faqTitle: { tr: "Sıkça sorulanlar", en: "Frequently asked" } as L,
    faqSub: { tr: "Cevabını bulamadın mı? Ekibimize yaz.", en: "Can't find an answer? Reach our team." } as L,
    ctaTitle: { tr: "Bir sonraki teklifini bugün kazan", en: "Win your next proposal today" } as L,
    ctaSub: { tr: "Anahtarsız demo modda aç, hazır olunca Supabase, Dropbox Sign ve Stripe'ı bağla.", en: "Open the keyless demo, then wire Supabase, Dropbox Sign and Stripe when you're ready." } as L,
  };

  return (
    <>
      {/* ── HERO ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "var(--grad-hero)" }} aria-hidden />
        <div className="pointer-events-none absolute inset-0 -z-10 aurora" style={{ background: "var(--grad-mesh)" }} aria-hidden />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:py-24 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Left copy */}
          <div className="stagger">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-pill">
              <span className="h-1.5 w-1.5 rounded-full bg-primary pulse-dot" />
              {t(m.badge)}
            </span>
            <h1 className="mt-5 max-w-xl font-display text-[40px] font-bold leading-[1.03] tracking-[-0.03em] sm:text-[58px]">
              {t(m.heroTitle)}{" "}
              <span className="text-gradient">{t(m.heroAccent)}</span>
            </h1>
            <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-muted-foreground">{t(m.heroSubtitle)}</p>

            <ul className="mt-6 space-y-2.5">
              {HERO_BENEFITS.map((b) => (
                <li key={tt(b)} className="flex items-start gap-2.5 text-[15px]">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success/12 text-success">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {tt(b)}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-[15px] font-semibold text-primary-foreground shadow-glow transition-opacity hover:opacity-90"
              >
                {t(m.heroCtaPrimary)} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 text-[15px] font-semibold text-foreground shadow-pill transition-colors hover:bg-muted"
              >
                {t(m.heroCtaSecondary)}
              </Link>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              {lang === "tr" ? "Kredi kartı gerekmez · Anahtarsız demo · 5 dakikada kurulum" : "No credit card · Keyless demo · 5-minute setup"}
            </p>
          </div>

          {/* Right floating product preview */}
          <div className="relative animate-float-up lg:pl-4">
            <div className="absolute -left-6 -top-6 -z-10 h-40 w-40 rounded-full bg-primary/15 blur-3xl drift" aria-hidden />
            <div className="absolute -bottom-8 -right-4 -z-10 h-44 w-44 rounded-full bg-accent/15 blur-3xl" aria-hidden />
            <ProductPreview />
          </div>
        </div>

        {/* Trusted-by row */}
        <div className="border-y border-border bg-card/50">
          <div className="mx-auto max-w-6xl px-5 py-6">
            <p className="text-center text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {lang === "tr" ? "Modern satış ekipleri tarafından kullanılıyor" : "Used by modern sales teams"}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 sm:gap-x-12">
              {TRUSTED.map((c) => (
                <CompanyMark key={c} name={c} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAND ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-soft sm:grid-cols-4">
          {[
            { value: "+35%", label: { tr: "ortalama kazanma artışı", en: "avg win rate lift" } as L },
            { value: "4×", label: { tr: "daha hızlı teklif", en: "faster to send" } as L },
            { value: "12K+", label: { tr: "imzalanan teklif", en: "proposals signed" } as L },
            { value: "1 tık", label: { tr: "ile imza", en: "to sign" } as L },
          ].map((s) => (
            <div key={s.value} className="bg-card px-5 py-8 text-center">
              <p className="font-display text-3xl font-bold tracking-tight">{s.value}</p>
              <p className="mt-1.5 text-xs text-muted-foreground">{tt(s.label)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── INTERACTIVE DEMO ──────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="label-mono text-primary">{lang === "tr" ? "Etkileşimli" : "Interactive"}</p>
            <h2 className="mt-2 max-w-md font-display text-3xl font-bold tracking-tight sm:text-4xl">{tt(sectionCopy.demoTitle)}</h2>
            <p className="mt-3 max-w-md text-muted-foreground">{tt(sectionCopy.demoSub)}</p>
            <div className="mt-6 grid grid-cols-3 gap-3">
              {m.stats.slice(0, 3).map((s) => (
                <div key={s.value} className="rounded-xl border border-border bg-card p-3 shadow-soft">
                  <p className="tnum text-xl font-bold leading-none">{s.value}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{t(s.label)}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 space-y-2.5 text-[14px]">
              {[
                { icon: MousePointerClick, label: { tr: "Müşteri opsiyonel kalemleri seçer", en: "Client toggles optional items" } as L },
                { icon: Plus, label: { tr: "Toplam canlı yeniden hesaplanır", en: "The total recomputes live" } as L },
                { icon: PenLine, label: { tr: "Kabul et & imzala — imza belirir", en: "Accept & sign — a signature appears" } as L },
              ].map((r) => {
                const I = r.icon;
                return (
                  <div key={tt(r.label)} className="flex items-center gap-2.5">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <I className="h-3.5 w-3.5" />
                    </span>
                    {tt(r.label)}
                  </div>
                );
              })}
            </div>
          </div>
          <SignDemo />
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────── */}
      <section id="features" className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{tt(sectionCopy.featuresTitle)}</h2>
            <p className="mt-3 text-muted-foreground">{tt(sectionCopy.featuresSub)}</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {m.features.map((f) => (
              <div key={tt(f.title)} className="group rounded-2xl border border-border bg-card p-6 shadow-soft transition-shadow hover:shadow-pop">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon name={f.icon} className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold tracking-tight">{t(f.title)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t(f.body)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEEP-DIVE FEATURE BLOCKS ──────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{tt(sectionCopy.deepTitle)}</h2>
          <p className="mt-3 text-muted-foreground">{tt(sectionCopy.deepSub)}</p>
        </div>
        <div className="mt-14 space-y-16">
          {DEEP_DIVE.map((d) => (
            <div
              key={tt(d.title)}
              className={cn("grid items-center gap-10 lg:grid-cols-2", d.reverse && "lg:[&>*:first-child]:order-2")}
            >
              <div>
                <p className="label-mono text-primary">{tt(d.eyebrow)}</p>
                <h3 className="mt-2 max-w-md font-display text-2xl font-bold tracking-tight sm:text-3xl">{tt(d.title)}</h3>
                <p className="mt-3 max-w-md text-muted-foreground">{tt(d.body)}</p>
                <ul className="mt-5 space-y-2.5">
                  {d.points.map((p) => (
                    <li key={tt(p)} className="flex items-start gap-2.5 text-[15px]">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      {tt(p)}
                    </li>
                  ))}
                </ul>
              </div>
              {/* illustrative panel */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                {d.panel === "ai" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 p-3">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-[13px] font-medium">{lang === "tr" ? "Brief: Northwind için marka + web" : "Brief: brand + web for Northwind"}</span>
                    </div>
                    <div className="space-y-2 rounded-xl border border-border p-3">
                      {[
                        lang === "tr" ? "Kapak yazıldı" : "Cover drafted",
                        lang === "tr" ? "Kapsam yazılıyor…" : "Drafting scope…",
                        lang === "tr" ? "Fiyatlandırma sırada" : "Pricing queued",
                      ].map((row, i) => (
                        <div key={row} className="flex items-center gap-2.5">
                          <span className={cn("grid h-5 w-5 place-items-center rounded-full", i === 0 ? "bg-success/12 text-success" : "bg-muted text-muted-foreground")}>
                            {i === 0 ? <Check className="h-3 w-3" strokeWidth={3} /> : <Clock className="h-3 w-3" />}
                          </span>
                          <span className="flex-1 text-[13px]">{row}</span>
                          {i === 1 && <span className="h-2 w-24 overflow-hidden rounded-full bg-muted shimmer" />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {d.panel === "pricing" && (
                  <div className="space-y-2.5">
                    {[
                      { l: lang === "tr" ? "Marka sistemi" : "Brand system", v: "$7,600", on: true },
                      { l: lang === "tr" ? "Web sitesi · 8 sayfa" : "Website · 8 pages", v: "$7,600", on: true },
                      { l: lang === "tr" ? "Sosyal kit (opsiyonel)" : "Social kit (optional)", v: "$1,800", on: true },
                      { l: lang === "tr" ? "Bakım (opsiyonel)" : "Care plan (optional)", v: "$3,600", on: false },
                    ].map((r) => (
                      <div key={r.l} className={cn("flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3", !r.on && "opacity-50")}>
                        <span className={cn("grid h-5 w-5 place-items-center rounded-md border", r.on ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                          {r.on && <Check className="h-3 w-3" strokeWidth={3} />}
                        </span>
                        <span className="flex-1 text-[13px] font-medium">{r.l}</span>
                        <span className="tnum text-[13px] font-semibold">{r.v}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between rounded-xl bg-primary/[0.06] px-3.5 py-2.5">
                      <span className="text-[13px] font-semibold">{lang === "tr" ? "Toplam" : "Total"}</span>
                      <span className="tnum text-lg font-bold text-primary">$17,000</span>
                    </div>
                  </div>
                )}
                {d.panel === "track" && (
                  <div className="space-y-2.5">
                    {[
                      { icon: Send, l: lang === "tr" ? "Gönderildi" : "Sent", t: "11 Jun · 09:20" },
                      { icon: Eye, l: lang === "tr" ? "İlk kez açıldı · Kapak" : "First open · Cover", t: "11 Jun · 14:02" },
                      { icon: Clock, l: lang === "tr" ? "Fiyatlandırmada 4dk" : "4m on Pricing", t: "12 Jun · 08:46" },
                      { icon: PenLine, l: lang === "tr" ? "İmza bekleniyor" : "Awaiting signature", t: lang === "tr" ? "şimdi" : "now" },
                    ].map((r, i) => {
                      const I = r.icon;
                      return (
                        <div key={r.l} className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
                          <span className={cn("grid h-7 w-7 place-items-center rounded-lg", i === 3 ? "bg-accent/15 text-accent" : "bg-primary/10 text-primary")}>
                            <I className="h-3.5 w-3.5" />
                          </span>
                          <span className="flex-1 text-[13px] font-medium">{r.l}</span>
                          <span className="tnum text-[11px] text-muted-foreground">{r.t}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────── */}
      <section id="how" className="border-y border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{tt(sectionCopy.howTitle)}</h2>
            <p className="mt-3 text-muted-foreground">{tt(sectionCopy.howSub)}</p>
          </div>
          <div className="relative mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {HOW_STEPS.map((s, i) => (
              <div key={s.n} className="relative rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon name={s.icon} className="h-[18px] w-[18px]" />
                  </span>
                  <span className="font-display text-2xl font-bold text-primary/15">{s.n}</span>
                </div>
                <h3 className="mt-3.5 font-semibold tracking-tight">{tt(s.title)}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{tt(s.body)}</p>
                {i < HOW_STEPS.length - 1 && (
                  <span className="absolute -right-3 top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 place-items-center rounded-full border border-border bg-card text-muted-foreground lg:grid">
                    <ArrowRight className="h-3 w-3" />
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VIEW-TRACKING DEEP-DIVE ───────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="label-mono text-primary">{lang === "tr" ? "Görüntüleme takibi" : "View tracking"}</p>
            <h2 className="mt-2 max-w-md font-display text-3xl font-bold tracking-tight sm:text-4xl">{tt(sectionCopy.trackTitle)}</h2>
            <p className="mt-3 max-w-md text-muted-foreground">{tt(sectionCopy.trackSub)}</p>
            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                { value: "3×", label: { tr: "açılma", en: "opens" } as L },
                { value: "4m", label: { tr: "fiyatlandırmada", en: "on pricing" } as L },
                { value: "2", label: { tr: "görüntüleyen", en: "viewers" } as L },
              ].map((s) => (
                <div key={s.value} className="rounded-xl border border-border bg-card p-3 shadow-soft">
                  <p className="tnum text-xl font-bold leading-none">{s.value}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{tt(s.label)}</p>
                </div>
              ))}
            </div>
          </div>
          {/* tracking dashboard preview */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-pop">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-lg text-white" style={{ backgroundImage: "var(--grad-brand)" }}>
                  <Eye className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[13px] font-semibold leading-tight">PRO-2048 · Northwind</p>
                  <p className="text-[11px] text-muted-foreground">{lang === "tr" ? "canlı izleniyor" : "live tracking"}</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-semibold text-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-accent pulse-dot" />
                {lang === "tr" ? "şu an açık" : "open now"}
              </span>
            </div>
            {/* per-section bars */}
            <div className="mt-4 space-y-3">
              {[
                { l: lang === "tr" ? "Kapak" : "Cover", pct: 40, time: "0:38" },
                { l: lang === "tr" ? "Kapsam" : "Scope", pct: 62, time: "1:36" },
                { l: lang === "tr" ? "Fiyatlandırma" : "Pricing", pct: 100, time: "4:04" },
                { l: lang === "tr" ? "Şartlar" : "Terms", pct: 28, time: "0:24" },
              ].map((row) => (
                <div key={row.l}>
                  <div className="mb-1 flex items-center justify-between text-[12.5px]">
                    <span className="font-medium">{row.l}</span>
                    <span className="tnum text-muted-foreground">{row.time}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${row.pct}%`, background: "var(--grad-brand)" }} />
                  </div>
                </div>
              ))}
            </div>
            {/* devices */}
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3 text-[12px]">
              <span className="inline-flex items-center gap-1.5 font-medium"><Monitor className="h-3.5 w-3.5 text-muted-foreground" /> {lang === "tr" ? "Masaüstü · 2×" : "Desktop · 2×"}</span>
              <span className="inline-flex items-center gap-1.5 font-medium"><Smartphone className="h-3.5 w-3.5 text-muted-foreground" /> {lang === "tr" ? "Mobil · 1×" : "Mobile · 1×"}</span>
              <button className="ml-auto inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
                {lang === "tr" ? "Hatırlat" : "Remind"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── USE CASES ─────────────────────────────────────────────── */}
      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{tt(sectionCopy.useCasesTitle)}</h2>
            <p className="mt-3 text-muted-foreground">{tt(sectionCopy.useCasesSub)}</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {USE_CASES.map((u) => (
              <div key={tt(u.title)} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon name={u.icon} className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold tracking-tight">{tt(u.title)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{tt(u.body)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPARISON TABLE ──────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-5 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{tt(sectionCopy.compareTitle)}</h2>
          <p className="mt-3 text-muted-foreground">{tt(sectionCopy.compareSub)}</p>
        </div>
        <div className="mt-12 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-4 text-left font-medium text-muted-foreground"></th>
                  <th className="px-5 py-4 text-center font-medium text-muted-foreground">{lang === "tr" ? "Word / PDF" : "Word / PDF"}</th>
                  <th className="px-5 py-4 text-center font-medium text-muted-foreground">{lang === "tr" ? "Genel araç" : "Generic tool"}</th>
                  <th className="bg-primary/[0.05] px-5 py-4 text-center">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
                      <FileSignature className="h-4 w-4" />
                      {appConfig.name}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row, i) => (
                  <tr key={tt(row.feature)} className={cn("border-b border-border/60 last:border-0", i % 2 === 1 && "bg-muted/20")}>
                    <td className="px-5 py-3.5 font-medium">{tt(row.feature)}</td>
                    <CompareCell value={row.word} lang={lang} />
                    <CompareCell value={row.generic} lang={lang} />
                    <CompareCell value={row.tender} lang={lang} highlight />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── INTEGRATIONS STRIP ────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pb-4">
        <div className="mx-auto max-w-2xl text-center">
          <h3 className="font-display text-2xl font-bold tracking-tight">{tt(sectionCopy.integrationsTitle)}</h3>
          <p className="mt-2 text-muted-foreground">{tt(sectionCopy.integrationsSub)}</p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {INTEGRATIONS.map((it) => (
            <div key={it.name} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-5 shadow-soft">
              <IntegrationGlyph glyph={it.glyph} />
              <div>
                <p className="font-semibold tracking-tight">{it.name}</p>
                <p className="text-xs text-muted-foreground">
                  {it.glyph === "db" ? (lang === "tr" ? "Veritabanı & auth" : "Database & auth") : it.glyph === "sign" ? (lang === "tr" ? "E-imza" : "E-signature") : it.glyph === "pay" ? (lang === "tr" ? "Ödemeler" : "Payments") : (lang === "tr" ? "AI taslak" : "AI drafting")}
                </p>
              </div>
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                {lang === "tr" ? "Hazır" : "Ready"}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{tt(sectionCopy.testimonialsTitle)}</h2>
          <p className="mt-3 text-muted-foreground">{tt(sectionCopy.testimonialsSub)}</p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((tm) => (
            <figure key={tm.name} className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-soft">
              <Quote className="h-5 w-5 text-primary/30" />
              <blockquote className="mt-3 flex-1 text-[14.5px] leading-relaxed text-foreground/90">
                {tt(tm.quote)}
              </blockquote>
              <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-bold text-white" style={{ backgroundImage: "var(--grad-brand)" }}>
                  {tm.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <figcaption className="text-sm font-semibold leading-tight">{tm.name}</figcaption>
                  <p className="truncate text-xs text-muted-foreground">{tt(tm.role)}</p>
                </div>
                <span className="rounded-full bg-success/10 px-2 py-1 text-[11px] font-semibold text-success">{tt(tm.metric)}</span>
              </div>
            </figure>
          ))}
        </div>
        <div className="mt-8 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="h-4 w-4 fill-warning text-warning" />
          ))}
          <span className="ml-2">{lang === "tr" ? "4.9/5 · 1.200+ ekip" : "4.9/5 · 1,200+ teams"}</span>
        </div>
      </section>

      {/* ── RESULTS BAND ──────────────────────────────────────────── */}
      <section className="border-t border-border bg-background">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
            {/* Featured proof quote */}
            <figure className="relative overflow-hidden rounded-3xl border border-border p-8 text-white shadow-pop" style={{ backgroundImage: "var(--grad-brand)" }}>
              <span className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-3xl drift" aria-hidden />
              <Quote className="h-7 w-7 text-white/40" />
              <blockquote className="mt-4 font-display text-2xl font-semibold leading-snug tracking-tight">
                {lang === "tr"
                  ? "SeelyDeal'a geçtikten sonraki çeyrekte kazanma oranımız %35 arttı ve teklif yazma süremiz dörtte bire düştü."
                  : "In the quarter after switching to SeelyDeal, our win rate climbed 35% and our proposal time dropped to a quarter."}
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3 border-t border-white/20 pt-5">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-white/15 text-sm font-bold">MG</span>
                <div>
                  <p className="text-sm font-semibold">Maria Gomez</p>
                  <p className="text-xs text-white/75">{lang === "tr" ? "Kurucu · Northwind" : "Founder · Northwind"}</p>
                </div>
              </figcaption>
            </figure>

            {/* Metric cards */}
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: Eye, value: "92%", label: { tr: "açılan teklif oranı", en: "open rate on sent" } as L, tone: "var(--seg-1)" },
                { icon: Clock, value: "11dk", label: { tr: "ortalama gönderim süresi", en: "avg time to send" } as L, tone: "var(--seg-2)" },
                { icon: PenLine, value: "1 tık", label: { tr: "ile imzalama", en: "to a signature" } as L, tone: "var(--seg-3)" },
                { icon: FileSignature, value: "+22%", label: { tr: "ortalama anlaşma büyüklüğü", en: "avg deal size" } as L, tone: "var(--seg-4)" },
              ].map((s) => {
                const I = s.icon;
                return (
                  <div key={s.value} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                    <span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: s.tone }}>
                      <I className="h-[18px] w-[18px]" />
                    </span>
                    <p className="mt-4 font-display text-3xl font-bold tracking-tight">{s.value}</p>
                    <p className="mt-1 text-[13px] text-muted-foreground">{tt(s.label)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────────── */}
      <section id="pricing" className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{tt(sectionCopy.pricingTitle)}</h2>
            <p className="mt-3 text-muted-foreground">{tt(sectionCopy.pricingSub)}</p>
          </div>

          <div className="mt-8 flex items-center justify-center gap-3">
            <span className={cn("text-sm font-medium", !annual && "text-foreground", annual && "text-muted-foreground")}>
              {tt(sectionCopy.billingMonthly)}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={annual}
              onClick={() => setAnnual((v) => !v)}
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                annual ? "bg-primary" : "bg-muted-foreground/30",
              )}
            >
              <span
                className={cn(
                  "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-soft transition-transform",
                  annual ? "translate-x-5" : "translate-x-0",
                )}
              />
            </button>
            <span className={cn("text-sm font-medium", annual && "text-foreground", !annual && "text-muted-foreground")}>
              {tt(sectionCopy.billingAnnual)}
            </span>
            <span className="ml-1 rounded-full bg-success/12 px-2 py-0.5 text-xs font-semibold text-success">
              {tt(sectionCopy.billingSave)}
            </span>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {m.pricing.map((tier) => (
              <div
                key={tier.name}
                className={cn(
                  "flex flex-col rounded-2xl border bg-card p-7 shadow-soft",
                  tier.featured ? "border-primary/40 shadow-pop ring-1 ring-primary/20" : "border-border",
                )}
              >
                {tier.featured && (
                  <span className="mb-3 inline-flex w-fit items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                    <Star className="h-3 w-3 fill-current" />
                    {tt(sectionCopy.popular)}
                  </span>
                )}
                <h3 className="font-semibold tracking-tight">{tier.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-bold tracking-tight">
                    {annual || tier.annualOnly ? tier.price : tier.monthlyPrice ?? tier.price}
                  </span>
                  {tier.period && <span className="text-sm text-muted-foreground">{t(tier.period)}</span>}
                </div>
                {tier.annualOnly && (
                  <p className="mt-1 text-xs font-medium text-muted-foreground">{tt(sectionCopy.annualOnlyNote)}</p>
                )}
                <p className="mt-1.5 text-sm text-muted-foreground">{t(tier.tagline)}</p>
                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {tier.features.map((f) => (
                    <li key={t(f)} className="flex items-start gap-2.5">
                      <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-success/12 text-success">
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </span>
                      {t(f)}
                    </li>
                  ))}
                </ul>
                {tier.annualOnly ? (
                  <button
                    onClick={() => setDemoTier(tier.name)}
                    className={cn(
                      "mt-7 inline-flex h-11 items-center justify-center rounded-xl text-sm font-semibold transition-all",
                      tier.featured
                        ? "bg-primary text-primary-foreground shadow-glow hover:opacity-90"
                        : "border border-border bg-card text-foreground hover:bg-muted",
                    )}
                  >
                    {t(tier.cta)}
                  </button>
                ) : (
                  <Link
                    href="/signup"
                    className={cn(
                      "mt-7 inline-flex h-11 items-center justify-center rounded-xl text-sm font-semibold transition-all",
                      tier.featured
                        ? "bg-primary text-primary-foreground shadow-glow hover:opacity-90"
                        : "border border-border bg-card text-foreground hover:bg-muted",
                    )}
                  >
                    {t(tier.cta)}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────── */}
      <section id="faq" className="mx-auto max-w-3xl px-5 py-20">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{tt(sectionCopy.faqTitle)}</h2>
          <p className="mt-3 text-muted-foreground">{tt(sectionCopy.faqSub)}</p>
        </div>
        <div className="mt-10 space-y-3">
          {m.faq.map((f) => (
            <details key={t(f.q)} className="group rounded-xl border border-border bg-card px-5 py-4 shadow-soft">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {t(f.q)}
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-colors group-open:border-primary group-open:bg-primary group-open:text-primary-foreground">
                  <Plus className="h-3.5 w-3.5 group-open:hidden" />
                  <Minus className="hidden h-3.5 w-3.5 group-open:block" />
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t(f.a)}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-8 py-16 text-center shadow-pop">
          <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "var(--grad-hero)" }} aria-hidden />
          <div className="pointer-events-none absolute inset-0 -z-10 aurora" style={{ background: "var(--grad-mesh)" }} aria-hidden />
          <span className="pointer-events-none absolute -left-10 top-0 -z-10 h-48 w-48 rounded-full bg-primary/15 blur-3xl drift" aria-hidden />
          <div className="mx-auto mb-5 flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-pill">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>{lang === "tr" ? "AI taslak · tek tıkla imza" : "AI drafting · one-click sign"}</span>
          </div>
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">{tt(sectionCopy.ctaTitle)}</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{tt(sectionCopy.ctaSub)}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-7 text-[15px] font-semibold text-primary-foreground shadow-glow transition-opacity hover:opacity-90"
            >
              {t(m.heroCtaPrimary)} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-border bg-card px-7 text-[15px] font-semibold text-foreground shadow-pill transition-colors hover:bg-muted"
            >
              {t(m.heroCtaSecondary)}
            </Link>
          </div>
        </div>
      </section>

      {demoTier && <DemoRequestDialog tier={demoTier} onClose={() => setDemoTier(null)} />}
    </>
  );
}

function IntegrationGlyph({ glyph }: { glyph: "db" | "sign" | "pay" | "ai" }) {
  const color =
    glyph === "db" ? "var(--color-success)" : glyph === "sign" ? "var(--color-primary)" : glyph === "pay" ? "var(--seg-3)" : "var(--color-accent)";
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: color }}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {glyph === "db" && <path d="M4 6 c0 -1.7 3.6 -3 8 -3 s8 1.3 8 3 v12 c0 1.7 -3.6 3 -8 3 s-8 -1.3 -8 -3 z M4 6 c0 1.7 3.6 3 8 3 s8 -1.3 8 -3 M4 12 c0 1.7 3.6 3 8 3 s8 -1.3 8 -3" />}
        {glyph === "sign" && <path d="M3 17 c4 -3 6 3 9 -1 c2 -2.6 4 1.4 9 -3 M5 21 h14" />}
        {glyph === "pay" && <path d="M3 7 h18 v10 h-18 z M3 11 h18 M7 15 h3" />}
        {glyph === "ai" && <path d="M12 3 l1.8 4.4 L18 9 l-4.2 1.6 L12 15 l-1.8 -4.4 L6 9 l4.2 -1.6 z M18 15 l.9 2.1 L21 18 l-2.1 .9 L18 21 l-.9 -2.1 L15 18 l2.1 -.9 z" />}
      </svg>
    </span>
  );
}

function CompareCell({
  value,
  lang,
  highlight = false,
}: {
  value: boolean | L | string;
  lang: "tr" | "en";
  highlight?: boolean;
}) {
  const text = typeof value === "string" ? value : typeof value === "object" ? value[lang] : null;
  return (
    <td className={cn("px-5 py-3.5 text-center", highlight && "bg-primary/[0.05]")}>
      {typeof value === "boolean" ? (
        value ? (
          <span className={cn("mx-auto grid h-5 w-5 place-items-center rounded-full", highlight ? "bg-primary text-primary-foreground" : "bg-success/12 text-success")}>
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        ) : (
          <span className="mx-auto grid h-5 w-5 place-items-center rounded-full bg-muted text-muted-foreground">
            <Minus className="h-3 w-3" />
          </span>
        )
      ) : (
        <span className={cn("text-[13px] font-medium", highlight ? "text-primary" : "text-muted-foreground")}>{text}</span>
      )}
    </td>
  );
}
