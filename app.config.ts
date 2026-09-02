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
  /** Hide this item entirely on the Lite plan (the feature has no equivalent there at all). */
  hideForLite?: boolean;
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

export interface PricingFeature {
  label: L;
  /** Optional hover tooltip (an "i" icon) for bullets whose name alone doesn't explain what they do. */
  description?: L;
}

export interface PricingTier {
  name: string;
  price: string;
  monthlyPrice?: string;
  annualOnly?: boolean;
  requiresDemo?: boolean;
  period?: L;
  tagline: L;
  features: PricingFeature[];
  /** "Everything in X, plus:" header shown above the feature list, without a checkmark — not a feature itself. */
  includesLabel?: L;
  cta: L;
  featured?: boolean;
  /** Hides the numeric price entirely and shows customPriceLabel instead ("Talk to us" tiers). */
  customPricing?: boolean;
  customPriceLabel?: L;
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
  /** Shows a "Connect" button in Settings that starts the OAuth2 flow at /api/integrations/[key]/connect. */
  oauth?: boolean;
  /** Listed but not actually wired up yet — shows "Coming soon" instead of a Connect/Connected state, even if its env vars happen to be set. */
  comingSoon?: boolean;
}

export interface AppConfig {
  name: string;
  tagline: L;
  description: L;
  domain: string;
  contactEmail: string;
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

/**
 * Pay-to-continue pack once a company's monthly AI draft quota runs out, per plan.
 * Lite finalized 2026-08-04 (proportional to its 10/mo quota, same $6/draft rate as
 * the old flat pack). Pro/Custom are still the old placeholder numbers — not yet
 * decided, revisit before either plan has real paying customers.
 */
export const aiOveragePack: Record<"lite" | "pro" | "custom", { extraDrafts: number; price: number }> = {
  lite: { extraDrafts: 5, price: 30 },
  pro: { extraDrafts: 25, price: 150 },
  custom: { extraDrafts: 25, price: 150 },
};

/** Pro's (formerly "Growth") one-time setup fee — full price on monthly billing, discounted on annual. Not shown publicly (site only says "Ek ücrete tabidir"); used when drafting the actual sales proposal/quote. */
export const proSetupFee = { monthly: 500, annual: 250 };

/** Custom's one-time setup fee — annual-only (no monthly option; Custom deals are long-term commitments, a single month wouldn't make sense). Deliberately kept above Pro's $500 ceiling to reflect Custom's premium positioning, not just raw setup hours. Not shown publicly. */
export const customSetupFee = 750;

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
  domain: "seelydeal.seelynow.com",
  contactEmail: "elif@seelynow.ink",
  logoText: "S",
  accentName: "violet",

  marketing: {
    badge: { tr: "Ajanslar & danışmanlar için, kapanış odaklı", en: "For agencies & consultants, built to close" },
    heroTitle: {
      tr: "Kazanan teklifler",
      en: "Proposals that",
    },
    heroAccent: {
      tr: "AI ile yazılır, tek tıkla imzalanır.",
      en: "win, drafted by AI.",
    },
    heroSubtitle: {
      tr: "Anlat, SeelyDeal markana ve müşterine göre güzel bir teklif yazsın. Etkileşimli fiyat tablosuyla gönder, açıldığını takip et ve müşterin tek tıkla imzalasın.",
      en: "Describe it, and SeelyDeal drafts a gorgeous proposal in your brand and your client's voice. Send it with an interactive pricing table, track when it's opened, and let your client sign in one click.",
    },
    heroCtaPrimary: { tr: "Ücretsiz başla", en: "Start free" },
    heroCtaSecondary: { tr: "Kayıt Olmadan Demoyu İncele", en: "See the live demo" },
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
      { name: "Lite", price: "$25", monthlyPrice: "$39", period: { tr: "/kullanıcı/ay", en: "/user/mo" }, tagline: { tr: "Küçük ekipler ve bireysel kullanım için.", en: "For small teams and individuals." }, features: [{ label: { tr: "AI ile teklif yazımı", en: "AI proposal drafting" } }, { label: { tr: "E-imza", en: "E-signature" } }, { label: { tr: "Görüntüleme takibi", en: "View tracking" } }, { label: { tr: "10 AI teklif hakkı/ay", en: "10 AI proposal credits/mo" } }], cta: { tr: "Ücretsiz Dene", en: "Try for Free" } },
      { name: "Pro", price: "$38", monthlyPrice: "$45", requiresDemo: true, period: { tr: "/kullanıcı/ay", en: "/user/mo" }, tagline: { tr: "Entegrasyon ve otomasyona ihtiyaç duyan büyüyen ekipler için.", en: "For growing teams that need integrations and automation." }, includesLabel: { tr: "Lite paketindeki tüm özellikler +", en: "Everything in the Lite plan, plus" }, features: [{ label: { tr: "Entegrasyonlar ve otomasyonlar", en: "Integrations and automations" }, description: { tr: "SeelyDeal'i popüler CRM'lerinizle bağlayın. Verileri dokümanlara aktarın ve SeelyDeal ile teknoloji altyapınız arasında otomatik iş akışları oluşturun.", en: "Connect SeelyDeal with popular CRMs. Pull data into documents and publish automated flows between SeelyDeal and your tech stack." } }, { label: { tr: "Doküman analitiği", en: "Document analytics" }, description: { tr: "Alıcının teklifinizi kaç kez açtığını ve teklifin her bölümünde ne kadar süre geçirdiğini görün.", en: "See exactly how many times your recipient opened your proposal and how much time they spent on each section." } }, { label: { tr: "AI destekli SeelyDeal kütüphanesi", en: "AI-powered SeelyDeal library" }, description: { tr: "Kayıtlı şablon ve sözleşmelerinizi otomatik kullanır. Standart teklif veya sözleşme formatınızı yükleyin; brief'te adını belirttiğinizde AI onu bulup birebir o yapıda kullanır.", en: "Automatically uses your saved templates and contracts. Upload your standard proposal or contract format; when you name it in your brief, AI finds it and follows it exactly." } }, { label: { tr: "Kurulum hizmeti", en: "Setup service" }, description: { tr: "Ek ücrete tabidir.", en: "Additional fee applies." } }, { label: { tr: "50 AI teklif hakkı/ay", en: "50 AI proposal credits/mo" } }], cta: { tr: "Demo Rezervasyonu", en: "Book a Demo" }, featured: true },
      { name: "Custom", price: "$1,200", customPricing: true, customPriceLabel: { tr: "Bize Ulaşın.", en: "Contact Us." }, requiresDemo: true, tagline: { tr: "Ölçekte kontrol ve görünürlük isteyen kurumlar için.", en: "For organizations that need control and visibility at scale." }, includesLabel: { tr: "Pro paketindeki tüm özellikler +", en: "Everything in the Pro plan, plus" }, features: [{ label: { tr: "SeelyDeal gelişmiş AI teklif yazımı (tam kurumsal entegrasyonlu)", en: "SeelyDeal advanced AI proposal drafting (fully enterprise-integrated)" }, description: { tr: "CRM ve muhasebe sistemlerinizle tam entegre çalışan en üst düzey yapay zeka altyapımız; akıllı koşullu içerikler, dinamik fiyat tabloları ve canlı müşteri takibiyle teklif süreçlerinizi tam kapasite otomatize eder.", en: "Our top-tier AI infrastructure, fully integrated with your CRM and accounting systems — it fully automates your proposal process with smart conditional content, dynamic pricing tables, and live client tracking." } }, { label: { tr: "API erişimi", en: "API access" }, description: { tr: "İhtiyaçlarınıza özel entegrasyonlar geliştirmek üzere API erişimi elde edin.", en: "Get API access to build integrations tailored to your needs." } }, { label: { tr: "Kullanıcı rolleri ve yetkilendirme", en: "User roles and permissions" }, description: { tr: "Ekip üyelerinize özel roller atayın; hangi alanlara erişebileceklerini ve hangi işlemleri yapabileceklerini tamamen siz yönetin.", en: "Assign custom roles to your team members — you fully control which areas they can access and what actions they can take." } }, { label: { tr: "SSO desteği", en: "SSO support" }, description: { tr: "Okta, Azure AD ve Salesforce gibi kurumsal kimlik sağlayıcılarınızla entegre olun; ekibinizin sisteme tek bir güvenli şifreyle erişmesini sağlayın.", en: "Integrate with enterprise identity providers like Okta, Azure AD, and Salesforce — let your team access the system with a single secure sign-on." } }, { label: { tr: "Kişiselleştirilmiş kurulum ve destek", en: "Personalized setup & support" }, description: { tr: "Şirketinize özel kurgulanan kurulum süreci ve süreç boyunca size atanan birebir teknik danışmanlık.", en: "A setup process built specifically for your company, with a dedicated technical advisor assigned to you throughout." } }, { label: { tr: "150 AI teklif hakkı/ay", en: "150 AI proposal credits/mo" } }], cta: { tr: "Bize Ulaşın", en: "Contact Us" } },
    ],
    faq: [
      { q: { tr: "SeelyDeal bir teklifi nasıl yazıyor?", en: "How does SeelyDeal draft a proposal?" }, a: { tr: "Doğal bir sohbet gibi anlat — müşteri kim, ne hizmet veriyorsun, fiyatlandırma nasıl olsun. AI eksik bilgi varsa tek tek sorar, istersen müşterinin web sitesini veya bir dosya (PDF, ekran görüntüsü) paylaş, oradan da bilgi çıkarır. Kendi standart şablonun varsa onu kullanır; yoksa kapak, kapsam, fiyat tablosu ve şartları senin marka dilinle kendisi yazar. Sen son rötuşu yaparsın.", en: "Just describe it like a conversation — who the client is, what service you're offering, how you want to price it. The AI asks for anything missing, and you can share the client's website or a file (PDF, screenshot) for it to pull details from. It uses your own standard template if you have one; otherwise it writes the cover, scope, pricing table and terms in your brand voice. You do the final polish." } },
      { q: { tr: "Görüntüleme takibi gerçekten ne gösteriyor?", en: "What does view tracking actually show?" }, a: { tr: "Teklifin açıldığı an durumu otomatik olarak 'Görüntülendi'ye döner, böylece müşterinin teklife baktığını hemen görürsün. Dashboard'daki mini grafik ve kazanma oranı, gönderdiğin tekliflerin genel performansını özetler.", en: "The moment a proposal is opened, its status automatically flips to 'Viewed', so you know right away the client has looked at it. The dashboard's mini chart and win rate summarize the overall performance of your sent proposals." } },
      { q: { tr: "E-imza yasal olarak bağlayıcı mı?", en: "Is the e-signature legally binding?" }, a: { tr: "Pakete göre değişir. Lite'da basit e-imza kullanılır — isim, zaman damgası ve IP/kaynak kaydıyla (denetim izi) toplanır, birçok sözleşme türü için geçerlidir. Pro'da kimlik doğrulamalı (gelişmiş) e-imza sunulur. Custom'da, resmi işlemler için kağıt imza ile eşdeğer kabul edilen nitelikli elektronik imza seçeneği vardır.", en: "It depends on your plan. Lite uses a simple e-signature — collected with a name, timestamp, and IP/audit trail, valid for many contract types. Pro offers identity-verified (advanced) e-signing. Custom includes a qualified electronic signature option, legally equal to a wet-ink signature for official processes." } },
      { q: { tr: "Etkileşimli fiyat tablosu nasıl çalışıyor?", en: "How does the interactive pricing table work?" }, a: { tr: "Müşterin opsiyonel kalemleri açıp kapatabilir ve adetleri ayarlayabilir; toplam anında güncellenir. Kabul edilen tutar, eklediğiniz ödeme linki üzerinden tahsil edilir.", en: "Clients can toggle optional line items and adjust quantities while the total updates live. The accepted amount is collected through the payment link you add." } },
      { q: { tr: "CRM'ime bağlanır mı?", en: "Does it connect to my CRM?" }, a: { tr: "Pro paketinde CRM'inizi bağlayıp verileri tekliflere otomatik aktarabilirsiniz. Muhasebe yazılımı (ör. Paraşüt, Logo, QuickBooks) entegrasyonu ve özel Salesforce entegrasyonu Custom pakete özeldir.", en: "On Pro, you can connect your CRM and pull data into proposals automatically. Accounting software integration (e.g. Paraşüt, Logo, QuickBooks) and the dedicated Salesforce integration are Custom-only." } },
    ],
  },

  navGroups: [
    {
      label: { tr: "Çalışma alanı", en: "Workspace" },
      items: [
        { label: { tr: "Panel", en: "Dashboard" }, href: "/dashboard", icon: "layout-dashboard" },
        { label: { tr: "Teklifler", en: "Proposals" }, href: "/proposals", icon: "file-text" },
        { label: { tr: "Şablonlar", en: "Templates" }, href: "/templates", icon: "layout-template" },
        { label: { tr: "Müşteriler", en: "Clients" }, href: "/clients", icon: "users" },
        { label: { tr: "İçerik kütüphanesi", en: "Content library" }, href: "/content", icon: "library" },
      ],
    },
    {
      label: { tr: "Yönetim", en: "Management" },
      items: [
        { label: { tr: "Analitik", en: "Analytics" }, href: "/analytics", icon: "chart-no-axes-column" },
        { label: { tr: "İmzalar", en: "Signatures" }, href: "/signatures", icon: "pen-line", hideForLite: true },
        { label: { tr: "Şirket profili", en: "Company profile" }, href: "/team", icon: "user-plus" },
        { label: { tr: "Entegrasyonlar", en: "Integrations" }, href: "/integrations", icon: "plug" },
      ],
    },
  ],

  nav: [
    { label: { tr: "Panel", en: "Dashboard" }, href: "/dashboard", icon: "layout-dashboard" },
    { label: { tr: "Teklifler", en: "Proposals" }, href: "/proposals", icon: "file-text" },
    { label: { tr: "Şablonlar", en: "Templates" }, href: "/templates", icon: "layout-template" },
    { label: { tr: "Ayarlar", en: "Settings" }, href: "/settings", icon: "settings" },
  ],

  // Integrations list rules (apply these to every new entry added here):
  // - `name` is a plain product name, no parenthetical suffixes like "(Pro)" or "(Claude)".
  // - Connected/active integrations are sorted to the top by integrations-client.tsx automatically.
  // - `purpose` is shown only as a hover preview (not inline) by integrations-client.tsx, so it can be long.
  //   Do not add "Without it, ... demo mode" style disclaimers — every row had the same sentence and it added noise.
  // - Plan-restricted rows with no action available show no status label at all ("Pro/Custom" was removed —
  //   meaningless once the viewer is already on the Custom plan). Only show a label when it's actionable
  //   (e.g. "Bağlan" button, or "Pro paketinde" when the viewer's plan genuinely blocks the feature).
  // - Connected rows use the brand primary color (text-primary / bg-primary/10), not green, and no pulse animation.
  // - The CRM/catch-all row's hover text lists concrete provider examples in plan order (Pro-tier providers first,
  //   Custom-tier providers like Salesforce last) so it's not a vague placeholder.
  // - The generic catch-all entry for future non-CRM integrations is named "Diğer Entegrasyonlar" (not tied to one provider).
  integrations: [
    {
      key: "supabase",
      name: "Supabase",
      envVars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
      required: false,
      docsUrl: "https://supabase.com/dashboard/project/_/settings/api",
      purpose: "Database & auth for proposals, clients and view events.",
    },
    {
      key: "dropbox_sign",
      name: "Dropbox Sign",
      envVars: ["DROPBOX_SIGN_API_KEY"],
      required: false,
      docsUrl: "https://app.hellosign.com/home/myAccount#api",
      purpose: "Legally binding e-signatures inside each proposal.",
      comingSoon: true,
    },
    {
      key: "stripe",
      name: "Stripe",
      envVars: ["STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"],
      required: false,
      docsUrl: "https://dashboard.stripe.com/apikeys",
      purpose: "Charge accepted proposals & deposits the moment a client signs.",
      comingSoon: true,
    },
    {
      key: "anthropic",
      name: "Anthropic",
      envVars: ["ANTHROPIC_API_KEY"],
      required: false,
      docsUrl: "https://console.anthropic.com/settings/keys",
      purpose: "Powers AI proposal drafting & rewrites.",
    },
    {
      key: "crm",
      name: "Diğer Entegrasyonlar",
      envVars: [],
      required: false,
      docsUrl: "",
      purpose: "Connect your CRM to pull client data into proposals automatically: HubSpot, Zoho (Pro). Accounting software (Logo, QuickBooks, Paraşüt) and Salesforce are Custom-only.",
      oauth: true,
    },
  ],
};

export default appConfig;
