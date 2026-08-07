/**
 * Demo data — what makes Tender feel alive with zero API keys. Labels are
 * bilingual ({ tr, en }); the dashboard resolves them to the active language.
 * Proper nouns and free text (client names, titles, emails) stay as-is. Replace
 * with real Supabase queries once setup wires your integrations.
 *
 * Domain: AI-assisted sales proposals & quotes — proposals move Draft → Sent →
 * Viewed → Accepted, carry a value and a view-activity timeline, and close with
 * an e-signature.
 */
import type { L } from "@/lib/i18n/config";

export type ProposalStatus = "draft" | "sent" | "viewed" | "accepted" | "declined";

/* ── Top stat row ──────────────────────────────────────────────────────────── */
export interface DStat {
  key: string;
  label: L;
  value: string;
  delta?: number;
  hint?: L;
}

const vsLast: L = { tr: "geçen aya göre", en: "vs last month" };

export const stats: DStat[] = [
  { key: "open", label: { tr: "Açık teklif", en: "Open proposals" }, value: "18", delta: 12.5, hint: { tr: "$214K boru hattı", en: "$214K in pipeline" } },
  { key: "winrate", label: { tr: "Kazanma oranı", en: "Win rate" }, value: "47%", delta: 6.2, hint: vsLast },
  { key: "avg", label: { tr: "Ort. anlaşma", en: "Avg deal size" }, value: "$11.9K", delta: 4.1, hint: vsLast },
  { key: "sent", label: { tr: "Bu ay gönderilen", en: "Sent this month" }, value: "31", delta: 18.0, hint: { tr: "9 görüntülendi", en: "9 viewed" } },
];

/* ── Pipeline (kanban-style status strip) ──────────────────────────────────── */
export interface PipelineCol {
  status: ProposalStatus;
  label: L;
  count: number;
  value: number;
}

export const pipeline: PipelineCol[] = [
  { status: "draft", label: { tr: "Taslak", en: "Draft" }, count: 6, value: 64200 },
  { status: "sent", label: { tr: "Gönderildi", en: "Sent" }, count: 7, value: 88400 },
  { status: "viewed", label: { tr: "Görüntülendi", en: "Viewed" }, count: 5, value: 61500 },
  { status: "accepted", label: { tr: "Kabul edildi", en: "Accepted" }, count: 9, value: 132900 },
];

/* ── Proposals table ───────────────────────────────────────────────────────── */
export interface ProposalSection {
  key: string;
  title: L;
  preview: L;
}

export interface ViewEvent {
  at: string;
  label: L;
  section?: L;
  seconds?: number;
  /** open/reopen/section-read events — collapsed on Lite, kept on Pro (document_analytics) */
  kind?: "open";
}

export interface LineItem {
  id: string;
  name: L;
  unit: number;
  qty: number;
  optional?: boolean;
  /** included by default when optional */
  included?: boolean;
}

export interface ProposalRow {
  id: string;
  number: string;
  title: L;
  client: string;
  clientEmail: string;
  clientInitials: string;
  value: number;
  status: ProposalStatus;
  sentDate: string | null;
  views: number;
  /** view-activity sparkline (per-day opens) */
  spark: number[];
  signed: boolean;
  /** human "opened 3× / 4m on pricing" style summary */
  viewSummary: L;
  sections: ProposalSection[];
  timeline: ViewEvent[];
  lineItems: LineItem[];
  template: L;
}

const coverPreview: L = {
  tr: "Northwind için hazırlanan teklif. Markanıza özel kapak, ekip ve geçerlilik tarihi.",
  en: "Prepared for Northwind. Branded cover, your team, and a valid-until date.",
};

export const proposals: ProposalRow[] = [
  {
    id: "p1",
    number: "PRO-2048",
    title: { tr: "Marka yenileme & web sitesi", en: "Brand refresh & website" },
    client: "Northwind",
    clientEmail: "maria@northwind.co",
    clientInitials: "NW",
    value: 24800,
    status: "viewed",
    sentDate: "2026-06-11T09:20:00Z",
    views: 3,
    spark: [0, 1, 0, 2, 1, 3, 2],
    signed: false,
    viewSummary: { tr: "3× açıldı · fiyatlandırmada 4dk", en: "Opened 3× · 4m on pricing" },
    template: { tr: "Tasarım hizmeti", en: "Design retainer" },
    sections: [
      { key: "cover", title: { tr: "Kapak", en: "Cover" }, preview: coverPreview },
      { key: "scope", title: { tr: "Kapsam", en: "Scope of work" }, preview: { tr: "Keşif, marka sistemi, 8 sayfalık web sitesi ve devir.", en: "Discovery, brand system, an 8-page website, and handoff." } },
      { key: "pricing", title: { tr: "Fiyatlandırma", en: "Pricing" }, preview: { tr: "Sabit ücret + opsiyonel bakım paketi.", en: "Fixed fee + optional care plan." } },
      { key: "terms", title: { tr: "Şartlar", en: "Terms" }, preview: { tr: "%50 peşin, 6 hafta teslim, 2 revizyon turu.", en: "50% upfront, 6-week delivery, 2 revision rounds." } },
      { key: "sign", title: { tr: "İmza", en: "Signature" }, preview: { tr: "Kabul etmek için imzalayın.", en: "Sign to accept." } },
    ],
    timeline: [
      { at: "2026-06-11T09:20:00Z", label: { tr: "Gönderildi", en: "Sent" } },
      { at: "2026-06-11T14:02:00Z", label: { tr: "İlk kez açıldı", en: "Opened first time" }, section: { tr: "Kapak", en: "Cover" }, seconds: 38, kind: "open" },
      { at: "2026-06-12T08:46:00Z", label: { tr: "Tekrar açıldı", en: "Re-opened" }, section: { tr: "Fiyatlandırma", en: "Pricing" }, seconds: 244, kind: "open" },
      { at: "2026-06-12T20:11:00Z", label: { tr: "Kapsam okundu", en: "Read scope" }, section: { tr: "Kapsam", en: "Scope" }, seconds: 96, kind: "open" },
    ],
    lineItems: [
      { id: "l1", name: { tr: "Keşif & strateji", en: "Discovery & strategy" }, unit: 3200, qty: 1 },
      { id: "l2", name: { tr: "Marka sistemi", en: "Brand system" }, unit: 7600, qty: 1 },
      { id: "l3", name: { tr: "Web sitesi (sayfa başı)", en: "Website (per page)" }, unit: 950, qty: 8 },
      { id: "l4", name: { tr: "Aylık bakım paketi", en: "Monthly care plan" }, unit: 600, qty: 6, optional: true, included: false },
    ],
  },
  {
    id: "p2",
    number: "PRO-2047",
    title: { tr: "Q3 performans pazarlama", en: "Q3 performance marketing" },
    client: "Parable",
    clientEmail: "liam@parable.io",
    clientInitials: "PB",
    value: 18600,
    status: "accepted",
    sentDate: "2026-06-08T11:00:00Z",
    views: 5,
    spark: [1, 2, 1, 3, 2, 0, 0],
    signed: true,
    viewSummary: { tr: "5× açıldı · imzalandı", en: "Opened 5× · signed" },
    template: { tr: "Pazarlama retainer", en: "Marketing retainer" },
    sections: [
      { key: "cover", title: { tr: "Kapak", en: "Cover" }, preview: coverPreview },
      { key: "scope", title: { tr: "Kapsam", en: "Scope of work" }, preview: { tr: "Ücretli sosyal, arama ve aylık raporlama.", en: "Paid social, search, and monthly reporting." } },
      { key: "pricing", title: { tr: "Fiyatlandırma", en: "Pricing" }, preview: { tr: "Aylık retainer + reklam bütçesi yönetimi.", en: "Monthly retainer + ad-spend management." } },
      { key: "terms", title: { tr: "Şartlar", en: "Terms" }, preview: { tr: "3 aylık taahhüt, aylık fatura.", en: "3-month commitment, billed monthly." } },
      { key: "sign", title: { tr: "İmza", en: "Signature" }, preview: { tr: "İmzalandı — Liam Chen.", en: "Signed — Liam Chen." } },
    ],
    timeline: [
      { at: "2026-06-08T11:00:00Z", label: { tr: "Gönderildi", en: "Sent" } },
      { at: "2026-06-08T15:30:00Z", label: { tr: "Açıldı", en: "Opened" }, section: { tr: "Fiyatlandırma", en: "Pricing" }, seconds: 180, kind: "open" },
      { at: "2026-06-09T09:10:00Z", label: { tr: "Şartlar okundu", en: "Read terms" }, section: { tr: "Şartlar", en: "Terms" }, seconds: 70, kind: "open" },
      { at: "2026-06-09T16:42:00Z", label: { tr: "Kabul edildi & imzalandı", en: "Accepted & signed" } },
    ],
    lineItems: [
      { id: "l1", name: { tr: "Strateji & kurulum", en: "Strategy & setup" }, unit: 4200, qty: 1 },
      { id: "l2", name: { tr: "Aylık yönetim", en: "Monthly management" }, unit: 3600, qty: 3 },
      { id: "l3", name: { tr: "Kreatif üretim", en: "Creative production" }, unit: 1200, qty: 3, optional: true, included: true },
    ],
  },
  {
    id: "p3",
    number: "PRO-2046",
    title: { tr: "Mobil uygulama MVP'si", en: "Mobile app MVP" },
    client: "Formwork",
    clientEmail: "nadia@formwork.studio",
    clientInitials: "FW",
    value: 42000,
    status: "sent",
    sentDate: "2026-06-12T16:40:00Z",
    views: 0,
    spark: [0, 0, 0, 0, 0, 0, 0],
    signed: false,
    viewSummary: { tr: "Henüz açılmadı", en: "Not opened yet" },
    template: { tr: "Yazılım projesi", en: "Software project" },
    sections: [
      { key: "cover", title: { tr: "Kapak", en: "Cover" }, preview: coverPreview },
      { key: "scope", title: { tr: "Kapsam", en: "Scope of work" }, preview: { tr: "iOS + Android MVP, 5 ana akış, 12 hafta.", en: "iOS + Android MVP, 5 core flows, 12 weeks." } },
      { key: "pricing", title: { tr: "Fiyatlandırma", en: "Pricing" }, preview: { tr: "Sabit kapsam + opsiyonel bakım.", en: "Fixed scope + optional maintenance." } },
      { key: "terms", title: { tr: "Şartlar", en: "Terms" }, preview: { tr: "Üç eşit ödeme, kilometre taşına bağlı.", en: "Three equal payments, milestone-based." } },
      { key: "sign", title: { tr: "İmza", en: "Signature" }, preview: { tr: "Kabul etmek için imzalayın.", en: "Sign to accept." } },
    ],
    timeline: [{ at: "2026-06-12T16:40:00Z", label: { tr: "Gönderildi", en: "Sent" } }],
    lineItems: [
      { id: "l1", name: { tr: "Ürün tasarımı", en: "Product design" }, unit: 9800, qty: 1 },
      { id: "l2", name: { tr: "Geliştirme (sprint başı)", en: "Development (per sprint)" }, unit: 5400, qty: 5 },
      { id: "l3", name: { tr: "QA & yayın", en: "QA & launch" }, unit: 5200, qty: 1 },
      { id: "l4", name: { tr: "3 aylık bakım", en: "3-month maintenance" }, unit: 1800, qty: 3, optional: true, included: false },
    ],
  },
  {
    id: "p4",
    number: "PRO-2045",
    title: { tr: "Yıllık danışmanlık retainer", en: "Annual advisory retainer" },
    client: "Cedarworks",
    clientEmail: "tom@cedarworks.com",
    clientInitials: "CW",
    value: 36000,
    status: "viewed",
    sentDate: "2026-06-10T13:15:00Z",
    views: 4,
    spark: [0, 2, 1, 1, 2, 1, 0],
    signed: false,
    viewSummary: { tr: "4× açıldı · 2 kişi", en: "Opened 4× · 2 people" },
    template: { tr: "Danışmanlık", en: "Consulting" },
    sections: [
      { key: "cover", title: { tr: "Kapak", en: "Cover" }, preview: coverPreview },
      { key: "scope", title: { tr: "Kapsam", en: "Scope of work" }, preview: { tr: "Aylık strateji, çeyreklik atölye, sınırsız Slack.", en: "Monthly strategy, quarterly workshops, unlimited Slack." } },
      { key: "pricing", title: { tr: "Fiyatlandırma", en: "Pricing" }, preview: { tr: "Aylık sabit retainer.", en: "Flat monthly retainer." } },
      { key: "terms", title: { tr: "Şartlar", en: "Terms" }, preview: { tr: "12 ay, 60 gün önce iptal.", en: "12 months, 60-day cancellation." } },
      { key: "sign", title: { tr: "İmza", en: "Signature" }, preview: { tr: "Kabul etmek için imzalayın.", en: "Sign to accept." } },
    ],
    timeline: [
      { at: "2026-06-10T13:15:00Z", label: { tr: "Gönderildi", en: "Sent" } },
      { at: "2026-06-10T18:00:00Z", label: { tr: "Açıldı", en: "Opened" }, section: { tr: "Kapsam", en: "Scope" }, seconds: 120, kind: "open" },
      { at: "2026-06-11T10:30:00Z", label: { tr: "Fiyatlandırmaya bakıldı", en: "Viewed pricing" }, section: { tr: "Fiyatlandırma", en: "Pricing" }, seconds: 210, kind: "open" },
      { at: "2026-06-13T09:05:00Z", label: { tr: "İkinci kişi açtı", en: "Second viewer opened" }, section: { tr: "Şartlar", en: "Terms" }, seconds: 88, kind: "open" },
    ],
    lineItems: [
      { id: "l1", name: { tr: "Aylık retainer", en: "Monthly retainer" }, unit: 3000, qty: 12 },
    ],
  },
  {
    id: "p5",
    number: "PRO-2044",
    title: { tr: "E-ticaret yeniden platformlama", en: "E-commerce re-platform" },
    client: "Harvest",
    clientEmail: "diego@harvest.farm",
    clientInitials: "HV",
    value: 28500,
    status: "draft",
    sentDate: null,
    views: 0,
    spark: [0, 0, 0, 0, 0, 0, 0],
    signed: false,
    viewSummary: { tr: "Taslak — gönderilmedi", en: "Draft — not sent" },
    template: { tr: "Yazılım projesi", en: "Software project" },
    sections: [
      { key: "cover", title: { tr: "Kapak", en: "Cover" }, preview: coverPreview },
      { key: "scope", title: { tr: "Kapsam", en: "Scope of work" }, preview: { tr: "Shopify'a geçiş, 1.200 ürün taşıma, tema.", en: "Migrate to Shopify, 1,200 SKUs, custom theme." } },
      { key: "pricing", title: { tr: "Fiyatlandırma", en: "Pricing" }, preview: { tr: "Aşama bazlı sabit ücret.", en: "Phased fixed fee." } },
      { key: "terms", title: { tr: "Şartlar", en: "Terms" }, preview: { tr: "Taslak — şartlar inceleniyor.", en: "Draft — terms under review." } },
      { key: "sign", title: { tr: "İmza", en: "Signature" }, preview: { tr: "Gönderildiğinde imza istenecek.", en: "Signature requested once sent." } },
    ],
    timeline: [],
    lineItems: [
      { id: "l1", name: { tr: "Migrasyon", en: "Migration" }, unit: 12500, qty: 1 },
      { id: "l2", name: { tr: "Özel tema", en: "Custom theme" }, unit: 11000, qty: 1 },
      { id: "l3", name: { tr: "Eğitim", en: "Training" }, unit: 2500, qty: 2, optional: true, included: false },
    ],
  },
  {
    id: "p6",
    number: "PRO-2043",
    title: { tr: "Lansman kampanyası", en: "Launch campaign" },
    client: "Lumen",
    clientEmail: "aisha@lumen.app",
    clientInitials: "LM",
    value: 9400,
    status: "accepted",
    sentDate: "2026-06-04T10:00:00Z",
    views: 6,
    spark: [2, 1, 1, 1, 1, 0, 0],
    signed: true,
    viewSummary: { tr: "6× açıldı · imzalandı", en: "Opened 6× · signed" },
    template: { tr: "Pazarlama retainer", en: "Marketing retainer" },
    sections: [
      { key: "cover", title: { tr: "Kapak", en: "Cover" }, preview: coverPreview },
      { key: "scope", title: { tr: "Kapsam", en: "Scope of work" }, preview: { tr: "Lansman planı, içerik ve PR desteği.", en: "Launch plan, content, and PR support." } },
      { key: "pricing", title: { tr: "Fiyatlandırma", en: "Pricing" }, preview: { tr: "Tek seferlik proje ücreti.", en: "One-time project fee." } },
      { key: "terms", title: { tr: "Şartlar", en: "Terms" }, preview: { tr: "%50 peşin, 4 hafta teslim.", en: "50% upfront, 4-week delivery." } },
      { key: "sign", title: { tr: "İmza", en: "Signature" }, preview: { tr: "İmzalandı — Aisha Khan.", en: "Signed — Aisha Khan." } },
    ],
    timeline: [
      { at: "2026-06-04T10:00:00Z", label: { tr: "Gönderildi", en: "Sent" } },
      { at: "2026-06-04T12:20:00Z", label: { tr: "Açıldı", en: "Opened" }, section: { tr: "Kapak", en: "Cover" }, seconds: 52, kind: "open" },
      { at: "2026-06-05T09:00:00Z", label: { tr: "Kabul edildi & imzalandı", en: "Accepted & signed" } },
    ],
    lineItems: [
      { id: "l1", name: { tr: "Kampanya yönetimi", en: "Campaign management" }, unit: 6400, qty: 1 },
      { id: "l2", name: { tr: "İçerik üretimi", en: "Content production" }, unit: 3000, qty: 1 },
    ],
  },
  {
    id: "p7",
    number: "PRO-2042",
    title: { tr: "SEO & içerik motoru", en: "SEO & content engine" },
    client: "Brightline",
    clientEmail: "emma@brightline.dev",
    clientInitials: "BL",
    value: 14200,
    status: "declined",
    sentDate: "2026-06-02T09:00:00Z",
    views: 2,
    spark: [1, 1, 0, 0, 0, 0, 0],
    signed: false,
    viewSummary: { tr: "2× açıldı · reddedildi", en: "Opened 2× · declined" },
    template: { tr: "Pazarlama retainer", en: "Marketing retainer" },
    sections: [
      { key: "cover", title: { tr: "Kapak", en: "Cover" }, preview: coverPreview },
      { key: "scope", title: { tr: "Kapsam", en: "Scope of work" }, preview: { tr: "Teknik SEO denetimi + aylık içerik.", en: "Technical SEO audit + monthly content." } },
      { key: "pricing", title: { tr: "Fiyatlandırma", en: "Pricing" }, preview: { tr: "Aylık retainer.", en: "Monthly retainer." } },
      { key: "terms", title: { tr: "Şartlar", en: "Terms" }, preview: { tr: "6 aylık taahhüt.", en: "6-month commitment." } },
      { key: "sign", title: { tr: "İmza", en: "Signature" }, preview: { tr: "Reddedildi.", en: "Declined." } },
    ],
    timeline: [
      { at: "2026-06-02T09:00:00Z", label: { tr: "Gönderildi", en: "Sent" } },
      { at: "2026-06-02T14:00:00Z", label: { tr: "Açıldı", en: "Opened" }, section: { tr: "Fiyatlandırma", en: "Pricing" }, seconds: 64, kind: "open" },
      { at: "2026-06-03T11:00:00Z", label: { tr: "Reddedildi", en: "Declined" } },
    ],
    lineItems: [
      { id: "l1", name: { tr: "SEO denetimi", en: "SEO audit" }, unit: 2800, qty: 1 },
      { id: "l2", name: { tr: "Aylık içerik", en: "Monthly content" }, unit: 1900, qty: 6 },
    ],
  },
  {
    id: "p8",
    number: "PRO-2041",
    title: { tr: "Yıllık tasarım sistemi", en: "Annual design system" },
    client: "Meridian",
    clientEmail: "owen@meridian.io",
    clientInitials: "MD",
    value: 31200,
    status: "sent",
    sentDate: "2026-06-13T08:30:00Z",
    views: 1,
    spark: [0, 0, 0, 0, 0, 0, 1],
    signed: false,
    viewSummary: { tr: "1× açıldı · az önce", en: "Opened 1× · just now" },
    template: { tr: "Tasarım hizmeti", en: "Design retainer" },
    sections: [
      { key: "cover", title: { tr: "Kapak", en: "Cover" }, preview: coverPreview },
      { key: "scope", title: { tr: "Kapsam", en: "Scope of work" }, preview: { tr: "Komponent kütüphanesi, dokümantasyon, eğitim.", en: "Component library, docs, and training." } },
      { key: "pricing", title: { tr: "Fiyatlandırma", en: "Pricing" }, preview: { tr: "Çeyreklik aşamalar.", en: "Quarterly phases." } },
      { key: "terms", title: { tr: "Şartlar", en: "Terms" }, preview: { tr: "Çeyreklik fatura.", en: "Billed quarterly." } },
      { key: "sign", title: { tr: "İmza", en: "Signature" }, preview: { tr: "Kabul etmek için imzalayın.", en: "Sign to accept." } },
    ],
    timeline: [
      { at: "2026-06-13T08:30:00Z", label: { tr: "Gönderildi", en: "Sent" } },
      { at: "2026-06-13T09:02:00Z", label: { tr: "İlk kez açıldı", en: "Opened first time" }, section: { tr: "Kapak", en: "Cover" }, seconds: 41, kind: "open" },
    ],
    lineItems: [
      { id: "l1", name: { tr: "Komponent kütüphanesi", en: "Component library" }, unit: 18000, qty: 1 },
      { id: "l2", name: { tr: "Dokümantasyon", en: "Documentation" }, unit: 7200, qty: 1 },
      { id: "l3", name: { tr: "Ekip eğitimi", en: "Team training" }, unit: 3000, qty: 2, optional: true, included: false },
    ],
  },
];

/* ── Acceptance over time (area chart) ─────────────────────────────────────── */
export const acceptance: { label: string; sent: number; accepted: number }[] = [
  { label: "Jan", sent: 18, accepted: 7 },
  { label: "Feb", sent: 22, accepted: 9 },
  { label: "Mar", sent: 20, accepted: 8 },
  { label: "Apr", sent: 27, accepted: 12 },
  { label: "May", sent: 29, accepted: 14 },
  { label: "Jun", sent: 31, accepted: 15 },
];

export const acceptanceMeta = {
  title: { tr: "Kabul, zaman içinde", en: "Acceptance over time" } as L,
  subtitle: { tr: "Son 6 ay · gönderilen vs kabul", en: "Last 6 months · sent vs accepted" } as L,
  delta: "+47%",
};

/* ── Templates strip ───────────────────────────────────────────────────────── */
export interface TemplateSection {
  title: L;
  body: L;
  /** Sanitized HTML override for this section (e.g. a design exported from an external tool). Rendered instead of `body` when present. */
  html?: string;
}

export interface Template {
  id: string;
  name: L;
  category: L;
  uses: number;
  winRate: number;
  accent: string;
  sections: TemplateSection[];
  /** Optional richer fields — carried through to a real proposal draft when "Bu şablonla yaz" is used. */
  introText?: L;
  aboutText?: L;
  lineItems?: { name: L; qty: number; unit: number }[];
  contractText?: L;
  /** Optional per-template visual theme, carried into the proposal draft and applied only to
   *  proposals created from this template (see app/p/[id]/page.tsx) — never touches global CSS. */
  theme?: { primaryColor: string; accentColor: string; font?: string };
  /** "sade" = short/neutral, no special theme. "kapsamli" = rich content, usually paired with a theme. */
  variant?: "sade" | "kapsamli";
  /** Short name recognized in AI chat (e.g. "leo") — only set on kapsamlı variants. See app/api/draft-proposal/route.ts. */
  nickname?: string;
}

const GENERIC_SECTIONS: TemplateSection[] = [
  { title: { tr: "Kapak", en: "Cover" }, body: { tr: "Logo, şirket adı, müşteri bilgileri ve proje başlığı.", en: "Logo, company name, client details, and project title." } },
  { title: { tr: "Kapsam", en: "Scope" }, body: { tr: "İşin kapsamı, teslim edilecekler ve zaman planı.", en: "Scope of work, deliverables, and timeline." } },
  { title: { tr: "Fiyatlandırma", en: "Pricing" }, body: { tr: "Kalem bazlı fiyat tablosu.", en: "Itemized pricing table." } },
  { title: { tr: "Şartlar", en: "Terms" }, body: { tr: "Ödeme ve teslim şartları.", en: "Payment and delivery terms." } },
  { title: { tr: "İmza", en: "Signature" }, body: { tr: "E-imza onay alanı.", en: "E-signature approval area." } },
];

export const templates: Template[] = [
  { id: "t1", name: { tr: "Tasarım hizmeti", en: "Design retainer" }, category: { tr: "Yaratıcı", en: "Creative" }, uses: 42, winRate: 58, accent: "var(--seg-1)", sections: GENERIC_SECTIONS },
  { id: "t2", name: { tr: "Pazarlama retainer", en: "Marketing retainer" }, category: { tr: "Pazarlama", en: "Marketing" }, uses: 36, winRate: 51, accent: "var(--seg-2)", sections: GENERIC_SECTIONS },
  { id: "t3", name: { tr: "Yazılım projesi", en: "Software project" }, category: { tr: "Teknoloji", en: "Technology" }, uses: 29, winRate: 44, accent: "var(--seg-3)", sections: GENERIC_SECTIONS },
  { id: "t4", name: { tr: "Danışmanlık", en: "Consulting" }, category: { tr: "Hizmet", en: "Services" }, uses: 21, winRate: 62, accent: "var(--seg-4)", sections: GENERIC_SECTIONS },
  {
    id: "t5",
    name: { tr: "İnşaat — Sade", en: "Construction — Simple" },
    category: { tr: "İnşaat", en: "Construction" },
    uses: 0,
    winRate: 0,
    accent: "var(--seg-1)",
    variant: "sade",
    introText: {
      tr: "Sayın Ahmet Yılmaz,\n\nVizyoner hedeflerinizi yakından takip ediyor ve Ticari Kompleks Cephe Yenileme Projesi'nde sizlere değer katmak için bu kapsamlı teklifi sunmaktan onur duyuyoruz. Projenin çevresel sürdürülebilirlik ve modern mimari estetik gereksinimlerini derinden anlıyoruz.\n\nAmacımız sadece bir cephe yenileme işlemi gerçekleştirmek değil, aynı zamanda binanın enerji verimliliğini artırarak uzun vadeli operasyonel maliyetlerinizi optimize etmektir. Yenilikçi malzeme seçimlerimiz ve detaylı iş planımızla, projenin günlük faaliyetlerinizi aksatmadan, belirlenen bütçe ve takvim sınırları içerisinde tamamlanmasını taahhüt ediyoruz.\n\nİşbirliğimizin her iki tarafa da uzun vadeli değer katacağına inancımız tamdır. Saygılarımızla.",
      en: "Dear Client,\n\nWe are honored to submit this comprehensive proposal for your Commercial Complex Facade Renovation Project. We understand the environmental sustainability and modern architectural aesthetic requirements of the project.\n\nOur goal is not only to complete a facade renovation, but to reduce your long-term operating costs by improving the building's energy efficiency — delivered on budget and on schedule without disrupting your daily operations.\n\nWe believe this partnership will create lasting value for both sides. Best regards.",
    },
    aboutText: {
      tr: "Yirmi yılı aşkın süredir endüstriyel tesisler, ticari kompleksler ve nitelikli üst yapı projelerinde anahtar teslim taahhüt hizmetleri sunuyoruz. Mühendislik disiplini ve yenilikçi inşaat teknolojilerini harmanlayarak, sektörde güvenilirliğin ve kalitenin sembolü haline geldik.\n\n\"Zorlu hava koşullarına ve sıkışık takvime rağmen, projeyi beklediğimizden çok daha yüksek bir kalite standardıyla ve bütçe sınırları içinde teslim ettiler.\" — Mehmet Demir, Genel Müdür, XYZ Lojistik A.Ş.",
      en: "For over twenty years we've delivered turnkey contracting services for industrial facilities, commercial complexes, and premium structures — combining engineering discipline with innovative construction technology.\n\n\"Despite tough weather and a tight schedule, they delivered well above our quality expectations and within budget.\" — Mehmet Demir, General Manager, XYZ Logistics.",
    },
    sections: [
      {
        title: { tr: "Kapsam Dahilinde", en: "Included in Scope" },
        body: {
          tr: "• Mevcut dış cephe kaplamalarının güvenli şekilde sökülmesi ve bertarafı.\n• Yeni nesil, enerji verimli alüminyum kompozit panel montajı (yaklaşık 15.000 m²).\n• Yüksek performanslı ısı yalıtım malzemelerinin uygulanması.\n• Cephe temizlik sistemi (gondol) altyapı hazırlığı ve montajı.\n• Şantiye güvenliği, iskele kurulumu ve trafik yönetimi.",
          en: "• Safe removal and disposal of existing facade cladding.\n• Next-gen, energy-efficient aluminum composite panel installation (~15,000 m²).\n• High-performance thermal insulation application.\n• Facade cleaning system (gondola) infrastructure and installation.\n• Site safety, scaffolding, and traffic management for the duration.",
        },
      },
      {
        title: { tr: "Kapsam Dışında", en: "Excluded from Scope" },
        body: {
          tr: "• İç mekan boya, badana ve dekorasyon işleri.\n• Doğramalar hariç cam değişimi (talep edilirse ek teklif sunulur).\n• Yapı ruhsatı/izin harçları (müşteri sorumluluğundadır).",
          en: "• Interior painting and decoration work.\n• Window glass replacement excluding frames (available as an add-on quote).\n• Building permit fees (client's responsibility).",
        },
      },
      {
        title: { tr: "Ekip", en: "Team" },
        body: {
          tr: "Proje müdürü, baş mühendis ve şantiye şefinden oluşan ekibimiz, sahada güvenli ve zamanında ilerleme için birlikte çalışır.",
          en: "Our project manager, lead engineer, and site supervisor work together to keep the job on schedule and on safety standard.",
        },
      },
      {
        title: { tr: "Kritik Tarihler", en: "Key Dates" },
        body: {
          tr: "Planlanan başlangıç: 15 Kasım 2024. Planlanan bitiş: 30 Mayıs 2025 (196 gün).",
          en: "Planned start: Nov 15, 2024. Planned completion: May 30, 2025 (196 days).",
        },
      },
    ],
    lineItems: [
      { name: { tr: "Malzeme: Alüminyum kompozit panel ve yalıtım", en: "Materials: Aluminum composite panel & insulation" }, qty: 15000, unit: 2.5 },
      { name: { tr: "İşçilik: Söküm, iskele kurulumu ve montaj", en: "Labor: Removal, scaffolding & installation" }, qty: 196, unit: 45 },
      { name: { tr: "Ekipman: Vinç kiralama ve güvenlik ağları", en: "Equipment: Crane rental & safety netting" }, qty: 6, unit: 300 },
      { name: { tr: "Taşeron: Cephe temizlik sistemi altyapısı", en: "Subcontractor: Facade cleaning system infra" }, qty: 1, unit: 1200 },
    ],
    contractText: {
      tr: "Bu teklif belgesi, taraflarca elektronik ortamda onaylandığı andan itibaren yasal bağlayıcılığı olan bir ön sözleşme niteliği taşır. Onay, işbu belgede belirtilen kapsam, takvim ve bedel üzerinden verilmiş sayılır; kapsam değişiklikleri yazılı ek sözleşme ile yapılır.",
      en: "This proposal becomes a legally binding preliminary agreement once approved electronically by both parties, on the scope, schedule and price stated herein; scope changes require a written change order.",
    },
  },
  {
    id: "t6",
    name: { tr: "İnşaat — Leo (Kapsamlı)", en: "Construction — Leo (Comprehensive)" },
    category: { tr: "İnşaat", en: "Construction" },
    uses: 0,
    winRate: 0,
    accent: "var(--seg-1)",
    variant: "kapsamli",
    nickname: "leo",
    theme: { primaryColor: "#00173c", accentColor: "#a04100", font: "Hanken Grotesk" },
    introText: {
      tr: "Sayın [Müşteri Yetkilisi],\n\n[Müşteri firma]nın hedeflerini yakından takip ediyor ve [proje adı]nda sizlere değer katmak için bu kapsamlı teklifi sunmaktan onur duyuyoruz. Projenin çevresel sürdürülebilirlik ve modern mimari estetik gereksinimlerini derinden anlıyoruz.\n\nAmacımız, sadece işi tamamlamak değil, aynı zamanda uzun vadeli operasyonel maliyetlerinizi optimize etmektir. Yenilikçi malzeme seçimlerimiz ve detaylı iş planımızla, belirlenen bütçe ve takvim sınırları içerisinde tamamlanmasını taahhüt ediyoruz.\n\nİşbirliğimizin her iki tarafa da uzun vadeli değer katacağına inancımız tamdır. Saygılarımızla.",
      en: "Dear [Client Contact],\n\nWe are honored to submit this comprehensive proposal for [project name]. We understand the environmental sustainability and modern architectural aesthetic requirements of the project.\n\nOur goal is not only to complete the work, but to optimize your long-term operating costs — delivered on budget and on schedule.\n\nWe believe this partnership will create lasting value for both sides. Best regards.",
    },
    aboutText: {
      tr: "Firmamız, yirmi yılı aşkın süredir endüstriyel tesisler, ticari kompleksler ve nitelikli üst yapı projelerinde anahtar teslim taahhüt hizmetleri sunmaktadır. Mühendislik disiplini ve yenilikçi inşaat teknolojilerini harmanlayarak, sektörde güvenilirliğin ve kalitenin sembolü haline geldik.\n\n\"Zorlu hava koşullarına ve sıkışık takvime rağmen, projeyi beklediğimizden çok daha yüksek bir kalite standardıyla ve bütçe sınırları içinde teslim ettiler.\" — [Referans Adı], [Unvan], [Referans Firma]",
      en: "For over twenty years we've delivered turnkey contracting services for industrial facilities, commercial complexes, and premium structures — combining engineering discipline with innovative construction technology.\n\n\"Despite tough weather and a tight schedule, they delivered well above our quality expectations and within budget.\" — [Reference Name], [Title], [Reference Company]",
    },
    sections: [
      {
        title: { tr: "Kapsam Dahilinde", en: "Included in Scope" },
        body: {
          tr: "• [Kapsam maddesi 1]\n• [Kapsam maddesi 2]\n• [Kapsam maddesi 3]\n• [Kapsam maddesi 4]\n• Şantiye güvenliği, iskele kurulumu ve trafik yönetimi.",
          en: "• [Scope item 1]\n• [Scope item 2]\n• [Scope item 3]\n• [Scope item 4]\n• Site safety, scaffolding, and traffic management for the duration.",
        },
      },
      {
        title: { tr: "Kapsam Dışında", en: "Excluded from Scope" },
        body: {
          tr: "• [Kapsam dışı madde 1]\n• [Kapsam dışı madde 2]\n• Yapı ruhsatı/izin harçları (müşteri sorumluluğundadır).",
          en: "• [Excluded item 1]\n• [Excluded item 2]\n• Building permit fees (client's responsibility).",
        },
      },
      {
        title: { tr: "Ekip", en: "Team" },
        body: {
          tr: "Proje müdürü, baş mühendis ve şantiye şefinden oluşan ekibimiz, sahada güvenli ve zamanında ilerleme için birlikte çalışır.",
          en: "Our project manager, lead engineer, and site supervisor work together to keep the job on schedule and on safety standard.",
        },
      },
      {
        title: { tr: "Kritik Tarihler", en: "Key Dates" },
        body: {
          tr: "Planlanan başlangıç: [tarih]. Planlanan bitiş: [tarih] ([X] gün).",
          en: "Planned start: [date]. Planned completion: [date] ([X] days).",
        },
      },
    ],
    lineItems: [
      { name: { tr: "Malzeme", en: "Materials" }, qty: 1, unit: 0 },
      { name: { tr: "İşçilik", en: "Labor" }, qty: 1, unit: 0 },
      { name: { tr: "Ekipman", en: "Equipment" }, qty: 1, unit: 0 },
      { name: { tr: "Taşeron", en: "Subcontractor" }, qty: 1, unit: 0 },
    ],
    contractText: {
      tr: "Bu teklif belgesi, taraflarca elektronik ortamda onaylandığı andan itibaren yasal bağlayıcılığı olan bir ön sözleşme niteliği taşır. Onay, işbu belgede belirtilen kapsam, takvim ve bedel üzerinden verilmiş sayılır; kapsam değişiklikleri yazılı ek sözleşme ile yapılır.",
      en: "This proposal becomes a legally binding preliminary agreement once approved electronically by both parties, on the scope, schedule and price stated herein; scope changes require a written change order.",
    },
  },
  {
    id: "t7",
    name: { tr: "Genel — Sade", en: "General — Simple" },
    category: { tr: "Genel", en: "General" },
    uses: 0,
    winRate: 0,
    accent: "var(--seg-2)",
    variant: "sade",
    introText: {
      tr: "Sayın [Müşteri Yetkilisi],\n\n[Proje/iş adı] için ihtiyaçlarınızı dinledik ve size en uygun çözümü bu teklifte topladık. Aşağıda kapsamı, takvimi ve fiyatlandırmayı bulabilirsiniz.\n\nSorularınız için her zaman buradayız. Saygılarımızla.",
      en: "Dear [Client Contact],\n\nWe listened to your needs for [project/work name] and put together the right solution for you below — scope, timeline, and pricing.\n\nWe're here for any questions. Best regards.",
    },
    aboutText: {
      tr: "[Firma adı], [sektör] alanında müşterilerine güvenilir ve hızlı çözümler sunar.",
      en: "[Company name] delivers reliable, fast solutions for clients in [industry].",
    },
    sections: [
      {
        title: { tr: "Kapsam", en: "Scope" },
        body: {
          tr: "• [Kapsam maddesi 1]\n• [Kapsam maddesi 2]\n• [Kapsam maddesi 3]",
          en: "• [Scope item 1]\n• [Scope item 2]\n• [Scope item 3]",
        },
      },
      {
        title: { tr: "Şartlar", en: "Terms" },
        body: {
          tr: "Ödeme ve teslim şartları [buraya].",
          en: "Payment and delivery terms [here].",
        },
      },
    ],
    lineItems: [
      { name: { tr: "Hizmet", en: "Service" }, qty: 1, unit: 0 },
    ],
    contractText: {
      tr: "Bu teklif, taraflarca elektronik ortamda onaylandığı andan itibaren yasal bağlayıcılığı olan bir ön sözleşme niteliği taşır.",
      en: "This proposal becomes a legally binding preliminary agreement once approved electronically by both parties.",
    },
  },
  {
    id: "t8",
    name: { tr: "Genel — Leo (Kapsamlı)", en: "General — Leo (Comprehensive)" },
    category: { tr: "Genel", en: "General" },
    uses: 0,
    winRate: 0,
    accent: "var(--seg-2)",
    variant: "kapsamli",
    nickname: "leo",
    introText: {
      tr: "Sayın [Müşteri Yetkilisi],\n\n[Müşteri firma]nın hedeflerini yakından takip ediyor ve [proje/iş adı]nda sizlere değer katmak için bu kapsamlı teklifi sunmaktan onur duyuyoruz.\n\nAmacımız, işi zamanında ve bütçe dahilinde teslim ederken uzun vadeli değer yaratmaktır.\n\nİşbirliğimizin her iki tarafa da uzun vadeli değer katacağına inancımız tamdır. Saygılarımızla.",
      en: "Dear [Client Contact],\n\nWe are honored to submit this comprehensive proposal for [project/work name] to help you reach your goals.\n\nOur aim is to deliver on time and on budget while creating lasting value.\n\nWe believe this partnership will create lasting value for both sides. Best regards.",
    },
    aboutText: {
      tr: "[Firma adı], yılların verdiği tecrübeyle [sektör] alanında güvenilir, kaliteli ve zamanında sonuçlar sunuyor.\n\n\"[Referans cümlesi].\" — [Referans Adı], [Unvan], [Referans Firma]",
      en: "[Company name] brings years of experience to deliver reliable, quality, on-time results in [industry].\n\n\"[Reference quote].\" — [Reference Name], [Title], [Reference Company]",
    },
    sections: [
      {
        title: { tr: "Kapsam Dahilinde", en: "Included in Scope" },
        body: {
          tr: "• [Kapsam maddesi 1]\n• [Kapsam maddesi 2]\n• [Kapsam maddesi 3]",
          en: "• [Scope item 1]\n• [Scope item 2]\n• [Scope item 3]",
        },
      },
      {
        title: { tr: "Kapsam Dışında", en: "Excluded from Scope" },
        body: {
          tr: "• [Kapsam dışı madde 1]\n• [Kapsam dışı madde 2]",
          en: "• [Excluded item 1]\n• [Excluded item 2]",
        },
      },
      {
        title: { tr: "Ekip", en: "Team" },
        body: {
          tr: "Projede yer alacak ekibimiz, sahada güvenli ve zamanında ilerleme için birlikte çalışır.",
          en: "Our team works together to keep the job on schedule and to standard.",
        },
      },
      {
        title: { tr: "Kritik Tarihler", en: "Key Dates" },
        body: {
          tr: "Planlanan başlangıç: [tarih]. Planlanan bitiş: [tarih] ([X] gün).",
          en: "Planned start: [date]. Planned completion: [date] ([X] days).",
        },
      },
    ],
    lineItems: [
      { name: { tr: "Hizmet / kalem 1", en: "Service / item 1" }, qty: 1, unit: 0 },
      { name: { tr: "Hizmet / kalem 2", en: "Service / item 2" }, qty: 1, unit: 0 },
    ],
    contractText: {
      tr: "Bu teklif belgesi, taraflarca elektronik ortamda onaylandığı andan itibaren yasal bağlayıcılığı olan bir ön sözleşme niteliği taşır. Onay, işbu belgede belirtilen kapsam, takvim ve bedel üzerinden verilmiş sayılır; kapsam değişiklikleri yazılı ek sözleşme ile yapılır.",
      en: "This proposal becomes a legally binding preliminary agreement once approved electronically by both parties, on the scope, schedule and price stated herein; scope changes require a written change order.",
    },
  },
];

/* ── Recent activity feed ──────────────────────────────────────────────────── */
export interface DActivity {
  id: string;
  who: string;
  action: L;
  target: string;
  at: string;
  tone: "neutral" | "success" | "warning" | "info";
  /** Hide this row on plans that don't have the feature it demonstrates (e.g. section-level analytics, reminders). */
  requires?: "document_analytics" | "reminders";
}

export const activity: DActivity[] = [
  { id: "a1", who: "Liam Chen", action: { tr: "imzaladı:", en: "signed" }, target: "PRO-2047", at: "2026-06-13T09:42:00Z", tone: "success" },
  { id: "a2", who: "Meridian", action: { tr: "ilk kez açtı:", en: "first opened" }, target: "PRO-2041", at: "2026-06-13T09:02:00Z", tone: "info" },
  { id: "a3", who: "Tom Reilly", action: { tr: "fiyatlandırmayı görüntüledi:", en: "viewed pricing on" }, target: "PRO-2045", at: "2026-06-13T08:30:00Z", tone: "info", requires: "document_analytics" },
  { id: "a4", who: "System", action: { tr: "hatırlatma gönderdi:", en: "sent a reminder for" }, target: "PRO-2048", at: "2026-06-12T18:00:00Z", tone: "warning", requires: "reminders" },
  { id: "a5", who: "Avery Rhodes", action: { tr: "AI ile taslak yazdı:", en: "AI-drafted" }, target: "PRO-2044", at: "2026-06-12T11:20:00Z", tone: "neutral" },
];

/* ── Proposal builder preview (the cockpit card) ───────────────────────────── */
export const builderPreview = {
  client: "Northwind",
  title: { tr: "Marka yenileme & web sitesi", en: "Brand refresh & website" } as L,
  validUntil: "2026-06-30",
  rep: "Avery Rhodes",
};

/**
 * Flat proposal rows for the Custom-plan "advanced reporting" demo (analytics
 * page, unauthenticated /demo shell) — expanded from `acceptance` so the
 * monthly trend chart and the CSV/PDF export both show the same story. Dated
 * over the 6 months up to now so the trend always reads as "recent".
 */
export const demoReportRows: { status: ProposalStatus; value: number; created_at: string }[] = (() => {
  const rows: { status: ProposalStatus; value: number; created_at: string }[] = [];
  const now = new Date();
  acceptance.forEach((m, i) => {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - (acceptance.length - 1 - i), 15);
    const iso = monthDate.toISOString();
    for (let a = 0; a < m.accepted; a++) rows.push({ status: "accepted", value: 9000 + ((a * 37) % 12) * 900, created_at: iso });
    const remaining = m.sent - m.accepted;
    const declined = Math.floor(remaining * 0.3);
    for (let d = 0; d < declined; d++) rows.push({ status: "declined", value: 0, created_at: iso });
    for (let s = 0; s < remaining - declined; s++) rows.push({ status: s % 2 === 0 ? "viewed" : "sent", value: 0, created_at: iso });
  });
  return rows;
})();

/**
 * Read-only mock data for the unauthenticated /demo shell's Clients, Team,
 * and Settings pages — these real pages query Supabase directly with the
 * signed-in user's session, so the demo shell (no session) needs its own
 * static stand-ins instead of reusing those client components.
 */
export interface DemoClient {
  id: string;
  name: string;
  company: string;
  proposalCount: number;
  totalValue: number;
  status: "active" | "lead";
}

export const demoClients: DemoClient[] = [
  { id: "c1", name: "Liam Chen", company: "Northwind", proposalCount: 4, totalValue: 38400, status: "active" },
  { id: "c2", name: "Priya Nair", company: "Meridian", proposalCount: 2, totalValue: 15200, status: "active" },
  { id: "c3", name: "Tom Reilly", company: "Bellcastle", proposalCount: 3, totalValue: 22750, status: "active" },
  { id: "c4", name: "Avery Rhodes", company: "Solace Group", proposalCount: 1, totalValue: 9000, status: "lead" },
  { id: "c5", name: "Mia Kowalski", company: "Fjord & Co", proposalCount: 5, totalValue: 51300, status: "active" },
  { id: "c6", name: "Diego Alvarez", company: "Lumen Works", proposalCount: 1, totalValue: 6800, status: "lead" },
];

export interface DemoTeamMember {
  id: string;
  name: string;
  email: string;
  role: { tr: string; en: string };
  initials: string;
}

export const demoTeamMembers: DemoTeamMember[] = [
  { id: "m1", name: "Elif Akyüz", email: "elif@seelynow.ink", role: { tr: "Sahip", en: "Owner" }, initials: "EA" },
  { id: "m2", name: "Avery Rhodes", email: "avery@seelynow.ink", role: { tr: "Yönetici", en: "Admin" }, initials: "AR" },
  { id: "m3", name: "Priya Nair", email: "priya@seelynow.ink", role: { tr: "Satış temsilcisi", en: "Sales rep" }, initials: "PN" },
  { id: "m4", name: "Tom Reilly", email: "tom@seelynow.ink", role: { tr: "Görüntüleyici", en: "Viewer" }, initials: "TR" },
];
