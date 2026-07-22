/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  app.config.ts — the single source of truth for this starter.            │
 * │                                                                          │
 * │  Every user-facing string is bilingual: { tr: "...", en: "..." }.        │
 * │  The guided setup (run `/setup`, or say "bu projeyi kur") edits this      │
 * │  file plus app/globals.css and .env.local.                               │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 *  TENDER — AI-assisted sales proposals & quotes. Build beautiful interactive
 *  proposals, send them, track views, and close with one-click e-signature.
 *  Modeled on real, polished products (Proposify, Qwilr). English brand; copy
 *  toggles TR/EN.
 */
import type { L } from "@/lib/i18n/config";

export type IconName = string;

export interface NavItem {
  label: L;
  href: string;
  icon: IconName;
  /** Optional "Soon" / "Beta" style badge shown muted in the sidebar. */
  badge?: L;
  /** Render as disabled/muted (e.g. a not-yet-shipped section). */
  muted?: boolean;
}

export interface NavGroup {
  label: L;
  items: NavItem[];
}

export interface Feature {
  icon: IconName;
  title: L;
  body: L;
}

export interface Stat {
  value: string;
  label: L;
}

export interface PricingTier {
  name: string;
  price: string;
  period?: L;
  tagline: L;
  features: L[];
  cta: L;
  featured?: boolean;
}

export interface FaqItem {
  q: L;
  a: L;
}

export interface Integration {
  key: string;
  name: string;
  envVars: string[];
  required: boolean;
  docsUrl: string;
  purpose: string;
}

export interface AppConfig {
  name: string;
  tagline: L;
  description: L;
  domain: string;
  logoText: string;
  accentName: string;
  marketing: {
    badge: L;
    heroTitle: L;
    heroAccent: L;
    heroSubtitle: L;
    heroCtaPrimary: L;
    heroCtaSecondary: L;
    features: Feature[];
    stats: Stat[];
    pricing: PricingTier[];
    faq: FaqItem[];
  };
  /** Sidebar navigation, grouped (Workspace / Management). */
  navGroups: NavGroup[];
  /** Flat nav (kept for the topbar title lookup + back-compat). */
  nav: NavItem[];
  integrations: Integration[];
}

export const appConfig: AppConfig = {
  name: "SeelyDeal",
  tagline: {
    tr: "AI ile yazılan, tek tıkla imzalanan teklifler.",
    en: "Proposals that win — drafted by AI, signed in one click.",
  },
  description: {
    tr: "Güzel, etkileşimli satış teklifleri ve fiyat tekliflerini AI ile dakikalar içinde hazırla, gönder, görüntülenmelerini izle ve e-imza ile kapat. Taslaktan imzaya kadar her şey tek panelde.",
    en: "Build beautiful, interactive sales proposals and quotes in minutes with AI, send them, track every view, and close with e-signature. From draft to signature, all in one panel.",
  },
  domain: "tender.deals",
  logoText: "S",
  accentName: "violet",

  marketing: {
    badge: { tr: "AI destekli teklif platformu", en: "AI-assisted proposal platform" },
    heroTitle: {
      tr: "Kazanan teklifler",
      en: "Proposals that",
    },
    heroAccent: {
      tr: "AI ile yazılır, tek tıkla imzalanır.",
      en: "win, drafted by AI.",
    },
    heroSubtitle: {
      tr: "Bir şablon seç, Tender markana ve müşterine göre güzel bir teklif yazsın. Etkileşimli fiyat tablosuyla gönder, her görüntülenmeyi izle ve müşterin tek tıkla imzalasın.",
      en: "Pick a template and Tender drafts a gorgeous proposal in your brand and your client's voice. Send it with an interactive pricing table, track every view, and let your client sign in one click.",
    },
    heroCtaPrimary: { tr: "Ücretsiz başla", en: "Start free" },
    heroCtaSecondary: { tr: "Canlı demoyu gör", en: "See the live demo" },
    features: [
      { icon: "sparkles", title: { tr: "AI taslak yazımı", en: "AI drafting" }, body: { tr: "Birkaç satır brief'ten kapak, kapsam, fiyatlandırma ve şartları markanın sesiyle yazan tam bir teklif çıkar.", en: "Turn a few lines of brief into a full proposal — cover, scope, pricing and terms — written in your brand voice." } },
      { icon: "table", title: { tr: "Etkileşimli fiyat tablosu", en: "Interactive pricing" }, body: { tr: "Müşterin seçenekleri ve adetleri seçsin, toplam anında güncellensin. Tekliften ödemeye sorunsuz.", en: "Let clients toggle options and quantities while the total recalculates live. Seamless from quote to payment." } },
      { icon: "eye", title: { tr: "Görüntüleme takibi", en: "View tracking" }, body: { tr: "Teklifin ne zaman açıldığını, hangi bölümde ne kadar kalındığını gör. Tam doğru anda takip et.", en: "See exactly when a proposal is opened and which section held attention. Follow up at the perfect moment." } },
      { icon: "pen-line", title: { tr: "Tek tıkla e-imza", en: "One-click e-signature" }, body: { tr: "Yasal olarak bağlayıcı imzaları teklifin içinde topla. PDF yok, ek yazılım yok, sürtünme yok.", en: "Collect legally binding signatures right inside the proposal. No PDFs, no extra app, no friction." } },
      { icon: "layout-template", title: { tr: "Şablon kütüphanesi", en: "Template library" }, body: { tr: "Onaylı, markaya uygun şablonlardan başla. Ekibin her seferinde sıfırdan değil, en iyiden başlasın.", en: "Start from on-brand, approved templates so your team begins from your best work, not a blank page." } },
      { icon: "chart-no-axes-column", title: { tr: "Teklif analitiği", en: "Proposal analytics" }, body: { tr: "Kazanma oranı, ortalama anlaşma büyüklüğü ve hangi bölümlerin anlaşmayı kapattığını gör.", en: "Track win rate, average deal size, and which sections actually close deals." } },
    ],
    stats: [
      { value: "+35%", label: { tr: "kazanma oranı", en: "win rate lift" } },
      { value: "4×", label: { tr: "daha hızlı teklif", en: "faster to send" } },
      { value: "1 tık", label: { tr: "ile imza", en: "to sign" } },
      { value: "100%", label: { tr: "izlenebilir", en: "trackable" } },
    ],
    pricing: [
      { name: "Solo", price: "$0", period: { tr: "/ay", en: "/mo" }, tagline: { tr: "İlk tekliflerini gönder.", en: "Send your first proposals." }, features: [{ tr: "Ayda 3 aktif teklif", en: "3 active proposals/mo" }, { tr: "AI taslak (sınırlı)", en: "AI drafting (limited)" }, { tr: "Görüntüleme takibi", en: "View tracking" }, { tr: "E-imza", en: "E-signature" }], cta: { tr: "Başla", en: "Get started" } },
      { name: "Studio", price: "$39", period: { tr: "/koltuk/ay", en: "/seat/mo" }, tagline: { tr: "Büyüyen satış ekipleri için.", en: "For growing sales teams." }, features: [{ tr: "Sınırsız teklif", en: "Unlimited proposals" }, { tr: "Sınırsız AI taslak", en: "Unlimited AI drafting" }, { tr: "Etkileşimli fiyatlandırma & ödeme", en: "Interactive pricing & payments" }, { tr: "Şablon kütüphanesi & marka", en: "Template library & branding" }, { tr: "Analitik & hatırlatmalar", en: "Analytics & reminders" }], cta: { tr: "Ücretsiz dene", en: "Start free trial" }, featured: true },
      { name: "Scale", price: "Custom", tagline: { tr: "Kurumsal satış ekipleri için.", en: "For enterprise sales orgs." }, features: [{ tr: "Studio'daki her şey", en: "Everything in Studio" }, { tr: "Onay akışları & roller", en: "Approval flows & roles" }, { tr: "CRM & Salesforce entegrasyonu", en: "CRM & Salesforce sync" }, { tr: "SSO, SAML & denetim kaydı", en: "SSO, SAML & audit log" }, { tr: "Özel hesap yöneticisi", en: "Dedicated manager" }], cta: { tr: "Satışa ulaş", en: "Contact sales" } },
    ],
    faq: [
      { q: { tr: "Tender bir teklifi nasıl yazıyor?", en: "How does Tender draft a proposal?" }, a: { tr: "Bir şablon seç ve birkaç satırlık brief gir — müşteri, kapsam, bütçe. AI kapak, kapsam, fiyat tablosu ve şartları markanın sesiyle yazar; sen son rötuşu yaparsın.", en: "Pick a template and enter a short brief — client, scope, budget. The AI writes the cover, scope, pricing table and terms in your brand voice; you do the final polish." } },
      { q: { tr: "Görüntüleme takibi gerçekten ne gösteriyor?", en: "What does view tracking actually show?" }, a: { tr: "Teklifin ne zaman ve kaç kez açıldığını, hangi bölümde ne kadar süre geçirildiğini ve hangi cihazdan görüntülendiğini gösterir — tam doğru anda takip için.", en: "It shows when and how many times a proposal was opened, how long was spent on each section, and on what device — so you can follow up at the perfect moment." } },
      { q: { tr: "E-imza yasal olarak bağlayıcı mı?", en: "Is the e-signature legally binding?" }, a: { tr: "Evet. İmzalar teklifin içinde toplanır, zaman damgası ve denetim kaydıyla saklanır. Dropbox Sign / DocuSign ile bağladığında tam uyumludur.", en: "Yes. Signatures are collected inside the proposal with a timestamp and audit trail, and are fully compliant once you wire Dropbox Sign / DocuSign." } },
      { q: { tr: "Etkileşimli fiyat tablosu nasıl çalışıyor?", en: "How does the interactive pricing table work?" }, a: { tr: "Müşterin opsiyonel kalemleri açıp kapatabilir ve adetleri ayarlayabilir; toplam anında güncellenir. Kabul edilen tutar doğrudan Stripe ile tahsil edilebilir.", en: "Clients can toggle optional line items and adjust quantities while the total updates live. The accepted amount can be charged directly through Stripe." } },
      { q: { tr: "Denemek için anahtar gerekli mi?", en: "Do I need any keys to try it?" }, a: { tr: "Hayır. Gerçekçi örnek teklifler, müşteriler ve görüntülenmelerle demo modda açılır — hemen tıklayabilirsin.", en: "No. It boots in demo mode with realistic sample proposals, clients and views — click around immediately." } },
      { q: { tr: "Teknoloji nedir?", en: "What's the stack?" }, a: { tr: "Next.js 16, React 19, Tailwind v4. Supabase, Dropbox Sign, Stripe ve bir LLM anahtarıyla bağlanır.", en: "Next.js 16, React 19, Tailwind v4. Wires to Supabase, Dropbox Sign, Stripe and an LLM key." } },
      { q: { tr: "CRM'ime bağlanır mı?", en: "Does it connect to my CRM?" }, a: { tr: "Scale planında teklifler ve durumları CRM/Salesforce ile çift yönlü senkronlanır; webhook'larla başka araçlara da bağlanabilirsin.", en: "On the Scale plan, proposals and their statuses sync two-way with your CRM/Salesforce; webhooks let you pipe into other tools too." } },
      { q: { tr: "Yayına alabilir miyim?", en: "Can I deploy it?" }, a: { tr: "Evet — standart bir Next.js uygulaması. Vercel'e veya herhangi bir Node sunucusuna gönder.", en: "Yes — it's a standard Next.js app. Push to Vercel or any Node host." } },
    ],
  },

  navGroups: [
    {
      label: { tr: "Çalışma alanı", en: "Workspace" },
      items: [
        { label: { tr: "Panel", en: "Dashboard" }, href: "/dashboard", icon: "layout-dashboard" },
        { label: { tr: "Teklifler", en: "Proposals" }, href: "/proposals", icon: "file-text" },
        { label: { tr: "Şablonlar", en: "Templates" }, href: "/templates", icon: "layout-template" },
        { label: { tr: "Müşteriler", en: "Clients" }, href: "/clients", icon: "users", muted: true },
        { label: { tr: "İçerik kütüphanesi", en: "Content library" }, href: "/content", icon: "library", badge: { tr: "Yakında", en: "Soon" }, muted: true },
      ],
    },
    {
      label: { tr: "Yönetim", en: "Management" },
      items: [
        { label: { tr: "Analitik", en: "Analytics" }, href: "/analytics", icon: "chart-no-axes-column", muted: true },
        { label: { tr: "İmzalar", en: "Signatures" }, href: "/signatures", icon: "pen-line", muted: true },
        { label: { tr: "Ekip", en: "Team" }, href: "/team", icon: "user-plus", muted: true },
        { label: { tr: "Entegrasyonlar", en: "Integrations" }, href: "/settings", icon: "plug" },
      ],
    },
  ],

  nav: [
    { label: { tr: "Panel", en: "Dashboard" }, href: "/dashboard", icon: "layout-dashboard" },
    { label: { tr: "Teklifler", en: "Proposals" }, href: "/proposals", icon: "file-text" },
    { label: { tr: "Şablonlar", en: "Templates" }, href: "/templates", icon: "layout-template" },
    { label: { tr: "Ayarlar", en: "Settings" }, href: "/settings", icon: "settings" },
  ],

  integrations: [
    {
      key: "supabase",
      name: "Supabase",
      envVars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
      required: false,
      docsUrl: "https://supabase.com/dashboard/project/_/settings/api",
      purpose: "Database & auth for proposals, clients and view events. Without it, the app runs in demo mode.",
    },
    {
      key: "dropbox_sign",
      name: "Dropbox Sign (HelloSign)",
      envVars: ["DROPBOX_SIGN_API_KEY"],
      required: false,
      docsUrl: "https://app.hellosign.com/home/myAccount#api",
      purpose: "Legally binding e-signatures inside each proposal. Without it, signing is a demo flow.",
    },
    {
      key: "stripe",
      name: "Stripe",
      envVars: ["STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"],
      required: false,
      docsUrl: "https://dashboard.stripe.com/apikeys",
      purpose: "Charge accepted proposals & deposits the moment a client signs. Demo charges otherwise.",
    },
    {
      key: "anthropic",
      name: "Anthropic (Claude)",
      envVars: ["ANTHROPIC_API_KEY"],
      required: false,
      docsUrl: "https://console.anthropic.com/settings/keys",
      purpose: "Powers AI proposal drafting & rewrites. Without it, AI suggestions are canned demo copy.",
    },
  ],
};

export default appConfig;
