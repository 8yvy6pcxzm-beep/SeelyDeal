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
export interface Template {
  id: string;
  name: L;
  category: L;
  uses: number;
  winRate: number;
  accent: string;
}

export const templates: Template[] = [
  { id: "t1", name: { tr: "Tasarım hizmeti", en: "Design retainer" }, category: { tr: "Yaratıcı", en: "Creative" }, uses: 42, winRate: 58, accent: "var(--seg-1)" },
  { id: "t2", name: { tr: "Pazarlama retainer", en: "Marketing retainer" }, category: { tr: "Pazarlama", en: "Marketing" }, uses: 36, winRate: 51, accent: "var(--seg-2)" },
  { id: "t3", name: { tr: "Yazılım projesi", en: "Software project" }, category: { tr: "Teknoloji", en: "Technology" }, uses: 29, winRate: 44, accent: "var(--seg-3)" },
  { id: "t4", name: { tr: "Danışmanlık", en: "Consulting" }, category: { tr: "Hizmet", en: "Services" }, uses: 21, winRate: 62, accent: "var(--seg-4)" },
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
