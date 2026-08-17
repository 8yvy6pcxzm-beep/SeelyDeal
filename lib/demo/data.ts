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
  /** Block-level signature audit trail (see supabase/migrations/20260817000000_add_block_signatures.sql)
   *  — only populated for real (non-demo) rows, used to hydrate the "signed" badge on
   *  reopen instead of only after a same-session sign click. */
  blockSignatures?: { blockId: string; blockType: string; signerRole: "company" | "client"; signerName: string; signedAt: string }[];
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
  /** Unset (default) = a pure visual/design skeleton (Görsel Şablonlar) — the AI
   *  only ever takes its `theme`, never its section text (see "ŞABLONLAR SADECE
   *  GÖRSELDİR" in app/api/draft-proposal/route.ts). "draft" = a real, usable
   *  starting proposal (Taslak Teklif Örnekleri) — its intro/sections/lineItems/
   *  contractText are genuine content the user can load into the editor and
   *  revise via lib/proposal-blocks/convert-legacy.ts + <BlockRenderer>. */
  kind?: "draft";
  /** Sector tag for "draft" templates — drives the sector chips in the AI chat
   *  modal (components/app/ai-draft-dialog.tsx) and lets Seely reference the
   *  right sector-specific defaults (see draft-proposal/route.ts). */
  sector?:
    | "construction"
    | "software"
    | "events"
    | "consulting"
    | "general"
    | "accounting"
    | "audit"
    | "enterprise_software"
    | "coaching"
    | "financial_services"
    | "hr_consulting"
    | "market_research";
  /** Legacy chat-nickname matching (app/api/draft-proposal/route.ts) — no demo
   *  template sets this anymore, kept only so that file's type still compiles. */
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
    name: { tr: "İnşaat", en: "Construction" },
    category: { tr: "İnşaat", en: "Construction" },
    uses: 0,
    winRate: 0,
    accent: "var(--seg-1)",
    kind: "draft",
    sector: "construction",
    theme: { primaryColor: "#00173c", accentColor: "#a04100", font: "Hanken Grotesk" },
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
    id: "t8",
    name: { tr: "Genel", en: "General" },
    category: { tr: "Genel", en: "General" },
    uses: 0,
    winRate: 0,
    accent: "var(--seg-2)",
    kind: "draft",
    sector: "general",
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
  {
    id: "t9",
    name: { tr: "İş Danışmanlığı Teklifi", en: "Business Consulting Proposal" },
    category: { tr: "Danışmanlık", en: "Consulting" },
    uses: 0,
    winRate: 0,
    accent: "var(--seg-4)",
    kind: "draft",
    sector: "consulting",
    sections: [
      {
        title: { tr: "Yönetici Özeti", en: "Executive Summary" },
        body: {
          tr: "Mevcut durum analizimize göre, organizasyonunuz sektördeki dönüşüm hızına ayak uydurmakta belirli darboğazlar yaşıyor; ancak güçlü marka mirası ve müşteri sadakati, doğru adımlarla hızla avantaja çevrilebilir. Önerdiğimiz \"Stratejik Netlik\" yaklaşımı, üst yönetimden saha operasyonlarına uzanan entegre bir değişim yönetimi sürecidir.",
          en: "Our current-state analysis shows your organization facing specific bottlenecks in keeping pace with sector-wide transformation — but strong brand equity and customer loyalty can be turned into an advantage quickly with the right steps. Our proposed \"Strategic Clarity\" approach is an integrated change-management process spanning from senior leadership to frontline operations.",
        },
      },
      {
        title: { tr: "Stratejimiz", en: "Our Strategy" },
        body: {
          tr: "1. Analiz — Pazar trendlerini ve rakip verilerini içeren kapsamlı bir veri toplama süreciyle temel dinamikleri belirliyoruz.\n2. Planlama — Net hedefler, kilometre taşları ve kaynak tahsisi içeren stratejik bir yol haritası oluşturuyoruz.\n3. Uygulama — Stratejiyi hayata geçirir, ekiplerinizle yakın işbirliği içinde süreçleri entegre ederiz.\n4. Optimizasyon — Performansı sürekli izler, KPI'ları ölçer ve sürdürülebilir başarı için iyileştiririz.",
          en: "1. Analysis — We establish core dynamics through comprehensive data collection covering market trends and competitive intelligence.\n2. Planning — We build a strategic roadmap with clear goals, milestones, and resource allocation.\n3. Execution — We put the strategy into action, integrating processes in close collaboration with your teams.\n4. Optimization — We continuously track performance, measure KPIs, and refine for sustainable success.",
        },
      },
      {
        title: { tr: "Hakkımızda / Ekibimiz", en: "About Us / Our Team" },
        body: {
          tr: "On yılı aşkın süredir üst yönetimden saha operasyonlarına kadar kurumsal dönüşüm projelerinde yönetim danışmanlığı hizmeti veriyoruz. Stratejik netlik, operasyonel çeviklik ve ölçülebilir sonuçlar üzerine kurulu metodolojimizle, karmaşık iş problemlerini uygulanabilir yol haritalarına dönüştürüyoruz.\n\n\"Zorlu bir pazar ortamında, net bir yol haritası ve disiplinli uygulamayla bize beklediğimizin çok üzerinde bir değer kattılar.\" — [Referans Adı], [Unvan], [Referans Firma]\n\nEkibimiz:\n• [Kıdemli Strateji Direktörü] — Kurumsal dönüşüm ve pazar giriş stratejileri konusunda [X] yıllık deneyim; karmaşık problemleri uygulanabilir yol haritalarına dönüştürmede uzman.\n• [Veri & Analitik Lideri] — Veriye dayalı karar alma süreçlerini optimize ederek ölçülebilir büyüme fırsatları yaratır.\n• [Operasyonel Mükemmellik Uzmanı] — Süreç iyileştirme ve maliyet optimizasyonu konusunda derin deneyime sahiptir.",
          en: "For over a decade we've provided management consulting across corporate transformation projects — from the boardroom to frontline operations. Our methodology, built on strategic clarity, operational agility, and measurable results, turns complex business problems into actionable roadmaps.\n\n\"In a tough market, they delivered far more value than we expected — with a clear roadmap and disciplined execution.\" — [Reference Name], [Title], [Reference Company]\n\nOur team:\n• [Senior Strategy Director] — [X] years of experience in corporate transformation and market-entry strategy; expert at turning complex problems into actionable roadmaps.\n• [Data & Analytics Lead] — Optimizes data-driven decision-making to create measurable growth opportunities.\n• [Operational Excellence Specialist] — Deep experience in process improvement and cost optimization.",
        },
      },
      {
        title: { tr: "Teslim Edilecekler ve Zaman Çizelgesi", en: "Deliverables & Timeline" },
        body: {
          tr: "Aşama 1: Keşif ve Analiz (Hafta 1-2) — Kapsamlı veri analizi raporu, paydaş görüşme özetleri, başlangıç durum değerlendirmesi.\nAşama 2: Strateji Geliştirme (Hafta 3-5) — Stratejik yol haritası taslağı, hedef operasyon modeli önerisi, risk ve fırsat matrisi.\nAşama 3: Uygulama ve Devir (Hafta 6-8) — Pilot uygulama sonuç raporu, kullanıcı eğitim materyalleri, nihai devir-teslim belgesi.",
          en: "Phase 1: Discovery & Analysis (Weeks 1-2) — Comprehensive data analysis report, stakeholder interview summaries, baseline assessment.\nPhase 2: Strategy Development (Weeks 3-5) — Draft strategic roadmap, target operating model proposal, risk & opportunity matrix.\nPhase 3: Implementation & Handover (Weeks 6-8) — Pilot results report, user training materials, final handover documentation.",
        },
      },
    ],
    lineItems: [
      { name: { tr: "Pazar Analizi & Strateji Geliştirme", en: "Market Analysis & Strategy Development" }, qty: 1, unit: 15000 },
      { name: { tr: "Operasyonel Dönüşüm Danışmanlığı (aylık)", en: "Operational Transformation Consulting (monthly)" }, qty: 3, unit: 12000 },
      { name: { tr: "Teknoloji Altyapısı Değerlendirmesi", en: "Technology Infrastructure Assessment" }, qty: 1, unit: 8500 },
    ],
    contractText: {
      tr: "İşbu sözleşme, Danışman tarafından Müşteri'ye sunulacak stratejik dönüşüm ve iş süreçleri optimizasyonu hizmetlerinin genel çerçevesini belirler.\n\nGizlilik ve Veri Güvenliği: Taraflar, işbu sözleşme kapsamında paylaştıkları tüm ticari, finansal ve teknik bilgileri gizli bilgi olarak kabul eder; yazılı onay olmaksızın üçüncü şahıslarla paylaşamaz.\n\nÜcretlendirme ve Ödeme Koşulları: Hizmet bedeli, kabul edilen fiyatlandırma teklifinde detaylandırıldığı üzere belirlenmiştir. Fatura kesim tarihinden itibaren ödeme vadesi 15 (on beş) iş günüdür.\n\nFesih Şartları: Taraflardan herhangi biri, 30 (otuz) gün önceden yazılı bildirimde bulunmak kaydıyla işbu sözleşmeyi tek taraflı olarak feshedebilir; fesih durumunda tamamlanan işlerin bedeli oransal olarak hesaplanarak ödenir.",
      en: "This agreement sets out the general framework for the strategic transformation and business process optimization services the Consultant will provide to the Client.\n\nConfidentiality & Data Security: The parties treat all commercial, financial, and technical information shared under this agreement as confidential and will not disclose it to third parties without written consent.\n\nFees & Payment Terms: Fees are as detailed in the accepted pricing proposal. Payment is due within 15 business days of the invoice date.\n\nTermination: Either party may terminate this agreement unilaterally with 30 days' written notice; in the event of termination, fees for completed work are calculated on a pro-rata basis.",
    },
  },
  {
    id: "t10",
    name: { tr: "Yazılım / Tasarım Projesi", en: "Software / Design Project" },
    category: { tr: "Yazılım", en: "Software" },
    uses: 0,
    winRate: 0,
    accent: "var(--seg-3)",
    kind: "draft",
    sector: "software",
    introText: {
      tr: "Sayın [Müşteri Yetkilisi],\n\n[Ürün/proje adı] için ekibinizle konuştuğumuz ihtiyaçlar doğrultusunda bu teklifi hazırlamaktan memnuniyet duyuyoruz. Amacımız, kullanıcı deneyimini önceliklendiren, sürdürülebilir ve ölçeklenebilir bir ürün ortaya çıkarmak.\n\nAşağıda projenin fazlarını, teslimlerini ve fiyatlandırmasını bulabilirsiniz.",
      en: "Dear [Client Contact],\n\nBased on what we discussed with your team about [product/project name], we're glad to share this proposal. Our goal is a sustainable, scalable product that puts user experience first.\n\nBelow you'll find the project phases, deliverables, and pricing.",
    },
    aboutText: {
      tr: "Ürün tasarımı ve yazılım geliştirme alanında uçtan uca ekiplerle çalışıyor, keşiften canlıya almaya kadar tüm süreci yönetiyoruz.\n\n\"Teslim tarihlerine sadık kaldılar ve kod kalitesi beklediğimizin üzerindeydi.\" — [Referans Adı], [Unvan], [Referans Firma]",
      en: "We work end-to-end on product design and software delivery, owning the process from discovery through to launch.\n\n\"They hit every deadline and the code quality exceeded our expectations.\" — [Reference Name], [Title], [Reference Company]",
    },
    sections: [
      {
        title: { tr: "Teslim Edilecekler", en: "Deliverables" },
        body: {
          tr: "• Keşif & analiz: kullanıcı görüşmeleri, gereksinim dokümanı.\n• UI/UX tasarım: Figma üzerinden wireframe ve yüksek çözünürlüklü tasarım teslimi, paylaşılabilir link.\n• Geliştirme: sprint bazlı ilerleme, her sprint sonunda staging ortamında demo.\n• Test & QA: fonksiyonel test raporu, hata (bug) kapatma.\n• Canlıya alma: production deploy, kaynak kod repo erişiminin devri.\n• Bakım & destek: canlıya almadan sonra [X] ay dahil destek periyodu.",
          en: "• Discovery & analysis: user interviews, requirements document.\n• UI/UX design: wireframes and high-fidelity design delivered via a shareable Figma link.\n• Development: sprint-based progress, staging demo at the end of each sprint.\n• Test & QA: functional test report, bug closure.\n• Launch: production deploy, source code repo access handover.\n• Maintenance & support: [X] months of included support after launch.",
        },
      },
      {
        title: { tr: "Kapsam Dışında", en: "Excluded from Scope" },
        body: {
          tr: "• Üçüncü parti lisans/servis ücretleri (barındırma, API vb.) müşteriye aittir.\n• Kapsam dışı yeni özellik talepleri ayrı teklif konusudur.",
          en: "• Third-party license/service fees (hosting, APIs, etc.) are the client's responsibility.\n• New feature requests outside scope require a separate quote.",
        },
      },
      {
        title: { tr: "Süreç", en: "Process" },
        body: {
          tr: "Sprint bazlı çalışıyoruz; her sprint sonunda staging ortamında canlı demo ve geri bildirim turu yapılır.",
          en: "We work in sprints; each sprint ends with a live staging demo and a feedback round.",
        },
      },
    ],
    lineItems: [
      { name: { tr: "Keşif & UI/UX Tasarım", en: "Discovery & UI/UX Design" }, qty: 1, unit: 25000 },
      { name: { tr: "Geliştirme (sprint)", en: "Development (sprint)" }, qty: 4, unit: 18000 },
      { name: { tr: "Test & QA", en: "Test & QA" }, qty: 1, unit: 6000 },
      { name: { tr: "Bakım & Destek (aylık)", en: "Maintenance & Support (monthly)" }, qty: 3, unit: 4000 },
    ],
    contractText: {
      tr: "Fikri Mülkiyet: Bedelin tamamı ödendikten sonra, teslim edilen kod ve tasarım varlıklarının mülkiyeti Müşteri'ye devredilir; bu tarihe kadar mülkiyet Yüklenici'de kalır.\n\nRevizyon Hakkı: Teklif kapsamına 2 (iki) revizyon turu dahildir; ek revizyonlar ayrıca ücretlendirilir.\n\nGizlilik: Taraflar, proje kapsamında paylaşılan tüm teknik ve ticari bilgileri gizli tutar.\n\nKapsam Değişikliği: Kapsam dışı yeni talepler yazılı ek teklif ile ücretlendirilir.",
      en: "Intellectual Property: Ownership of delivered code and design assets transfers to the Client upon full payment; until then it remains with the Contractor.\n\nRevisions: 2 rounds of revisions are included; additional revisions are billed separately.\n\nConfidentiality: Both parties keep all technical and commercial information shared during the project confidential.\n\nChange Requests: New requests outside scope are quoted and billed separately.",
    },
  },
  {
    id: "t11",
    name: { tr: "Etkinlik / Fotoğrafçılık", en: "Events / Photography" },
    category: { tr: "Etkinlik", en: "Events" },
    uses: 0,
    winRate: 0,
    accent: "var(--seg-1)",
    kind: "draft",
    sector: "events",
    introText: {
      tr: "Sayın [Müşteri Yetkilisi],\n\n[Etkinlik adı] için sizlere özel hazırladığımız bu teklifte, çekim planından teslim sürecine kadar tüm detayları bulabilirsiniz. Anınızı en iyi şekilde ölümsüzleştirmek için buradayız.",
      en: "Dear [Client Contact],\n\nHere is our proposal for [event name], covering everything from the shoot plan to delivery. We're here to capture your moment at its best.",
    },
    aboutText: {
      tr: "Etkinlik ve portre fotoğrafçılığında [X] yıllık deneyimimizle, doğal ve zamansız kareler üretiyoruz.\n\n\"Çekim günü çok profesyoneldiler, teslimler de söz verdikleri tarihte elimize ulaştı.\" — [Referans Adı]",
      en: "With [X] years in event and portrait photography, we deliver natural, timeless shots.\n\n\"They were fully professional on the day, and delivery arrived exactly when promised.\" — [Reference Name]",
    },
    sections: [
      {
        title: { tr: "Teslim Edilecekler", en: "Deliverables" },
        body: {
          tr: "• Çekim öncesi planlama görüşmesi ve mekan/konsept netleştirme.\n• Çekim günü: [X] saat süre, [Y] kişilik ekip.\n• Ham (düzenlenmemiş) görüntülerin teslimi: çekimden itibaren [X] gün içinde.\n• Düzenlenmiş/retouch edilmiş görsellerin teslimi: [X] adet, dijital galeri linki üzerinden.\n• Baskı seçenekleri: talep halinde ek ücretle albüm/baskı hizmeti.\n• Ek çekim/uzatma: saatlik ek ücretlendirme ile mümkündür.",
          en: "• Pre-shoot planning call and venue/concept confirmation.\n• Shoot day: [X] hours, a team of [Y].\n• Raw (unedited) image delivery: within [X] days of the shoot.\n• Edited/retouched image delivery: [X] photos, via a digital gallery link.\n• Print options: album/print service available for an extra fee on request.\n• Extra coverage: available at an hourly add-on rate.",
        },
      },
      {
        title: { tr: "Süreç", en: "Process" },
        body: {
          tr: "Planlama görüşmesi → çekim günü → ham teslim → düzenleme → nihai galeri teslimi.",
          en: "Planning call → shoot day → raw delivery → editing → final gallery delivery.",
        },
      },
    ],
    lineItems: [
      { name: { tr: "Çekim (yarım gün)", en: "Shoot (half day)" }, qty: 1, unit: 12000 },
      { name: { tr: "Düzenleme / Retouch (adet)", en: "Editing / Retouch (per photo)" }, qty: 50, unit: 80 },
      { name: { tr: "Dijital Galeri Teslimi", en: "Digital Gallery Delivery" }, qty: 1, unit: 1000 },
    ],
    contractText: {
      tr: "Kullanım/Lisans Hakları: Teslim edilen görsellerin ticari kullanım hakkı, aksi yazılı olarak belirtilmedikçe yalnızca Müşteri'ye tanınır; Yüklenici, portföy/tanıtım amaçlı kullanım hakkını saklı tutar.\n\nİptal/Erteleme: Çekim tarihinden [X] gün öncesine kadar yapılan iptal/erteleme taleplerinde kapora iadesi yapılmaz.\n\nMücbir Sebep: Hava koşulları veya öngörülemeyen mücbir sebepler nedeniyle çekim ertelenirse, yeni tarih karşılıklı mutabakatla belirlenir.\n\nTeslim Süresi: Belirtilen teslim süresine uyulmaması halinde, gecikilen her hafta için sözleşme bedelinin %[X]'i oranında telafi uygulanır.",
      en: "Usage/License Rights: Commercial usage rights to delivered images are granted solely to the Client unless stated otherwise in writing; the Contractor retains portfolio/promotional usage rights.\n\nCancellation/Rescheduling: Deposits are non-refundable for cancellations/reschedules made within [X] days of the shoot date.\n\nForce Majeure: If the shoot is postponed due to weather or unforeseeable force majeure, a new date is set by mutual agreement.\n\nDelivery Timeline: If the stated delivery timeline is missed, a [X]% compensation of the contract fee applies per week of delay.",
    },
  },
  {
    id: "t12",
    name: { tr: "Muhasebe Teklifi", en: "Accounting Proposal" },
    category: { tr: "Muhasebe", en: "Accounting" },
    uses: 0,
    winRate: 0,
    accent: "var(--seg-2)",
    kind: "draft",
    sector: "accounting",
    introText: {
      tr: "Sayın [Müşteri Yetkilisi],\n\nİşletmenizin sektöründeki dinamikleri ve büyüme hedeflerini yakından takip ediyor, finansal yönetim ve danışmanlık alanındaki uzmanlığımızla size değer katmak için bu teklifi sunmaktan memnuniyet duyuyoruz.\n\nYıllardır edindiğimiz deneyim ve topluma katkı odaklı çalışma anlayışımızla, işletmenize yalnızca doğru ve zamanında finansal raporlama değil, sürdürülebilir büyümeye giden yolda güvenilir bir danışmanlık ortaklığı sunmayı taahhüt ediyoruz.\n\nAşağıda hizmet kapsamımızı, ekibimizi ve şeffaf fiyatlandırmamızı bulabilirsiniz. Sorularınız için her zaman buradayız.",
      en: "Dear [Client Contact],\n\nWe closely follow the dynamics and growth goals of your industry, and we're glad to share this proposal to bring our financial management and advisory expertise to your business.\n\nWith years of experience and a genuine commitment to the communities we serve, we aim to deliver not just accurate, timely financial reporting, but a trusted advisory partnership on your path to sustainable growth.\n\nBelow you'll find our scope of services, our team, and transparent pricing. We're always here for your questions.",
    },
    aboutText: {
      tr: "On yılı aşkın süredir küçük ve orta ölçekli işletmelere muhasebe, vergi ve finansal danışmanlık hizmetleri sunuyoruz. Sektöre özel deneyimimizi, güncel mevzuat takibiyle birleştirerek işletmenize doğru ve zamanında finansal görünürlük kazandırıyoruz.\n\n\"Aylık raporlamaları hep zamanında aldık, vergi döneminde de yanımızda oldular — güvenilir bir ortak.\" — [Referans Adı], [Unvan], [Referans Firma]",
      en: "For over a decade we've provided accounting, tax, and financial advisory services to small and mid-sized businesses. We combine sector-specific experience with up-to-date regulatory knowledge to give your business accurate, timely financial visibility.\n\n\"Monthly reporting always arrived on time, and they were there for us at tax season — a reliable partner.\" — [Reference Name], [Title], [Reference Company]",
    },
    sections: [
      {
        title: { tr: "Ekip", en: "Team" },
        body: {
          tr: "Sürecinizi yönetecek ekibimiz, alanında sertifikalı ve deneyimli profesyonellerden oluşur:\n\n• [Sorumlu Muhasebeci Adı], SMMM — [X] yıllık deneyimiyle finansal raporlama ve vergi süreçlerinizi uçtan uca yönetir.\n• [Kıdemli Denetçi/CPA Adı], CPA — Finansal denetim ve uyum konularında derin uzmanlığa sahiptir.\n• [Finansal Danışman Adı] — Nakit akışı yönetimi ve bütçeleme konularında işletmenize stratejik destek sağlar.",
          en: "The professionals who will manage your engagement are certified and experienced:\n\n• [Lead Accountant Name], CPA — [X] years of experience managing end-to-end financial reporting and tax processes.\n• [Senior Auditor Name], CPA — Deep expertise in financial audit and compliance.\n• [Financial Advisor Name] — Provides strategic support on cash flow management and budgeting.",
        },
      },
      {
        title: { tr: "Proje Özeti", en: "Project Summary" },
        body: {
          tr: "Bu teklif, aşağıdaki hedeflere ulaşmanız için tasarlanmıştır:\n\n• Operasyonel verimliliği artırmak — muhasebe süreçlerinin dijitalleştirilmesi ve otomasyonu.\n• Nakit akışını iyileştirmek — düzenli nakit akışı projeksiyonları ve alacak/borç takibi.\n• Vergi mevzuatına tam uyum sağlamak — güncel mevzuat takibi ile risklerin en aza indirilmesi.",
          en: "This proposal is designed to help you reach the following goals:\n\n• Improve operational efficiency — digitizing and automating your accounting processes.\n• Improve cash flow — regular cash flow projections and receivables/payables tracking.\n• Ensure full tax compliance — minimizing risk through up-to-date regulatory monitoring.",
        },
      },
      {
        title: { tr: "Hizmet Kapsamı", en: "Proposal for Accounting Services" },
        body: {
          tr: "• Muhasebe Yazılımı Yönetimi — mevcut yazılımınızın (veya önerilen bir platformun) kurulumu, entegrasyonu ve aylık bakımı.\n• Finansal Raporlama — aylık/üç aylık bilanço, gelir tablosu ve nakit akış tablolarının hazırlanması.\n• Vergi Hazırlığı — KDV, kurumlar vergisi ve diğer beyannamelerin zamanında ve eksiksiz hazırlanması.\n• Borç/Alacak Yönetimi — cari hesap takibi, tahsilat süreçlerinin iyileştirilmesi.\n• Finansal Danışmanlık — bütçeleme, maliyet analizi ve büyüme stratejilerine yönelik periyodik değerlendirme toplantıları.\n\nTüm süreçler, aylık düzenli raporlama toplantıları ve dijital bir panel üzerinden şeffaf şekilde takip edilebilir hale getirilir.",
          en: "• Accounting Software Management — setup, integration, and monthly maintenance of your existing (or a recommended) platform.\n• Financial Reporting — monthly/quarterly balance sheet, income statement, and cash flow statement preparation.\n• Tax Preparation — timely, accurate preparation of VAT, corporate tax, and other filings.\n• Accounts Payable/Receivable Management — ledger tracking and improved collections processes.\n• Financial Advisory — periodic review meetings covering budgeting, cost analysis, and growth strategy.\n\nAll processes are made transparent through monthly reporting meetings and a digital dashboard.",
        },
      },
      {
        title: { tr: "Sonraki Adımlar", en: "Next Steps" },
        body: {
          tr: "1. Başlangıç Görüşmesi — hedeflerinizin ve mevcut süreçlerinizin netleştirilmesi (Hafta 1).\n2. Sistem Kurulumu ve Veri Aktarımı — muhasebe yazılımının kurulumu ve geçmiş verilerin aktarımı (Hafta 2-3).\n3. Personel Eğitimi — ilgili ekibinizin yeni süreç ve araçlar konusunda eğitilmesi (Hafta 4).\n4. Sürekli Destek — aylık raporlama, düzenli görüşmeler ve süreç iyileştirmeleriyle kesintisiz destek.",
          en: "1. Kickoff Meeting — clarifying your goals and current processes (Week 1).\n2. System Setup & Data Migration — accounting software setup and historical data migration (Weeks 2-3).\n3. Staff Training — training your relevant team on the new processes and tools (Week 4).\n4. Ongoing Support — uninterrupted support through monthly reporting, regular check-ins, and process improvements.",
        },
      },
      {
        title: { tr: "İletişim Bilgileri", en: "Contact Information" },
        body: {
          tr: "Görüşmeyi ilerletmek, sorularınızı yanıtlamak ve anlaşmayı sonlandırmak için buradayız:\n\n[Sorumlu Muhasebeci Adı]\n[Unvan] — [E-posta] — [Telefon]\n\n[Firma Adı] · [Adres]",
          en: "We're here to move the conversation forward, answer your questions, and finalize the agreement:\n\n[Lead Accountant Name]\n[Title] — [Email] — [Phone]\n\n[Company Name] · [Address]",
        },
      },
    ],
    lineItems: [
      { name: { tr: "Aylık Muhasebe & Finansal Raporlama", en: "Monthly Accounting & Financial Reporting" }, qty: 12, unit: 4500 },
      { name: { tr: "Vergi Hazırlığı & Beyanname Yönetimi", en: "Tax Preparation & Filing Management" }, qty: 12, unit: 2500 },
      { name: { tr: "Sistem Kurulumu & Veri Aktarımı (tek seferlik)", en: "System Setup & Data Migration (one-time)" }, qty: 1, unit: 15000 },
      { name: { tr: "Finansal Danışmanlık (saatlik)", en: "Financial Advisory (hourly)" }, qty: 10, unit: 1200 },
    ],
    contractText: {
      tr: "İşbu sözleşme, Muhasebe Firması tarafından Müşteri'ye sunulacak muhasebe, vergi ve finansal danışmanlık hizmetlerinin genel çerçevesini belirler.\n\nGizlilik: Taraflar, işbu sözleşme kapsamında paylaşılan tüm finansal ve ticari bilgileri gizli tutar; yazılı onay olmaksızın üçüncü şahıslarla paylaşamaz.\n\nÜcretlendirme ve Ödeme Koşulları: Hizmet bedeli, kabul edilen fiyatlandırma teklifinde belirtildiği üzeredir. Fatura kesim tarihinden itibaren ödeme vadesi 15 (on beş) iş günüdür.\n\nSorumluluk: Muhasebe Firması, Müşteri tarafından sağlanan verilerin doğruluğuna dayanarak hizmet verir; eksik/hatalı bilgi kaynaklı sonuçlardan sorumlu tutulamaz.\n\nFesih Şartları: Taraflardan herhangi biri, 30 (otuz) gün önceden yazılı bildirimde bulunmak kaydıyla işbu sözleşmeyi tek taraflı olarak feshedebilir.",
      en: "This agreement sets out the general framework for the accounting, tax, and financial advisory services the Accounting Firm will provide to the Client.\n\nConfidentiality: The parties treat all financial and commercial information shared under this agreement as confidential and will not disclose it to third parties without written consent.\n\nFees & Payment Terms: Fees are as detailed in the accepted pricing proposal. Payment is due within 15 business days of the invoice date.\n\nLiability: The Accounting Firm relies on the accuracy of data provided by the Client and is not liable for outcomes resulting from incomplete or incorrect information.\n\nTermination: Either party may terminate this agreement unilaterally with 30 days' written notice.",
    },
  },
  {
    id: "t13",
    name: { tr: "İşletme Denetimi Teklifi", en: "Business Audit Proposal" },
    category: { tr: "Denetim", en: "Audit" },
    uses: 0,
    winRate: 0,
    accent: "var(--seg-3)",
    kind: "draft",
    sector: "audit",
    introText: {
      tr: "Sayın [Müşteri Yetkilisi],\n\n[Şirket Adı] için hazırladığımız bu işletme denetimi teklifinde, finansal ve operasyonel süreçlerinizi kapsamlı şekilde değerlendirecek denetim sürecimizin tüm detaylarını bulacaksınız. Amacımız, riskleri erken aşamada tespit etmenizi sağlayan, şeffaf ve güvenilir bir denetim deneyimi sunmaktır.\n\nAşağıda hizmet kapsamımızı, denetim sürecimizi ve şeffaf fiyatlandırmamızı bulabilirsiniz. Sorularınız için her zaman buradayız.",
      en: "Dear [Client Contact],\n\nThis proposal for [Company Name] lays out every detail of our audit process, covering a comprehensive assessment of your financial and operational processes. Our goal is to give you a transparent, reliable audit experience that surfaces risk early.\n\nBelow you'll find our scope of services, our audit process, and transparent pricing. We're always here for your questions.",
    },
    aboutText: {
      tr: "On yılı aşkın süredir işletmelere finansal, operasyonel ve uyum denetimi hizmetleri sunuyoruz. Sektöre özel deneyimimizi güncel denetim standartlarıyla birleştirerek, işletmenizin gerçek risk ve fırsat tablosunu ortaya koyuyoruz.\n\n\"Denetim sürecinde son derece titiz ve şeffaftılar; raporları sayesinde gözden kaçırdığımız riskleri erkenden fark ettik.\" — [Referans Adı], [Unvan], [Referans Firma]",
      en: "For over a decade we've provided financial, operational, and compliance audit services to businesses. We combine sector-specific experience with current audit standards to surface your organization's real picture of risk and opportunity.\n\n\"They were meticulous and transparent throughout the audit — their reports helped us catch risks we'd otherwise have missed.\" — [Reference Name], [Title], [Reference Company]",
    },
    sections: [
      {
        title: { tr: "Hizmet Kapsamı", en: "Scope of Services" },
        body: {
          tr: "Denetimimiz, işletmenizin aşağıdaki alanlarını kapsamlı şekilde değerlendirir:\n\n• Finansal Değerlendirme — mali tabloların doğruluğu, iç kontrol süreçleri ve finansal raporlama standartlarına uyum.\n• Operasyonel Değerlendirme — süreç verimliliği, kaynak kullanımı ve operasyonel risk alanlarının analizi.\n• Uyum Denetimi — yürürlükteki mevzuat ve sektörel düzenlemelere uyumun kontrolü.\n• Risk Değerlendirmesi — finansal, operasyonel ve itibar riskinin tespiti ile önceliklendirilmesi.\n\nHer alan için bulgular, somut ve ölçülebilir öneriler eşliğinde raporlanır.",
          en: "Our audit provides a comprehensive assessment of the following areas of your business:\n\n• Financial Assessment — accuracy of financial statements, internal control processes, and compliance with financial reporting standards.\n• Operational Assessment — analysis of process efficiency, resource use, and operational risk areas.\n• Compliance Audit — verification of compliance with applicable laws and sector regulations.\n• Risk Assessment — identification and prioritization of financial, operational, and reputational risk.\n\nFindings for each area are reported alongside concrete, measurable recommendations.",
        },
      },
      {
        title: { tr: "Denetim Sürecimiz", en: "Our Process" },
        body: {
          tr: "1. Keşif ve Planlama — denetim kapsamının, hedeflerinin ve zaman çizelgesinin netleştirilmesi.\n2. Veri Toplama — finansal kayıtlar, süreç dokümantasyonu ve paydaş görüşmeleri yoluyla kanıt toplanması.\n3. Analiz — toplanan verilerin denetim standartlarına göre değerlendirilmesi, risk ve bulguların tespiti.\n4. Raporlama — bulguların, risklerin ve önerilerin net ve uygulanabilir bir rapor halinde sunulması.\n5. Değerlendirme Toplantısı — rapor üzerinden yönetimle birlikte önceliklerin ve aksiyon planının belirlenmesi.",
          en: "1. Discovery & Planning — clarifying the audit's scope, objectives, and timeline.\n2. Data Collection — gathering evidence through financial records, process documentation, and stakeholder interviews.\n3. Analysis — evaluating the collected data against audit standards, identifying risks and findings.\n4. Reporting — presenting findings, risks, and recommendations in a clear, actionable report.\n5. Review Meeting — working through the report with management to set priorities and an action plan.",
        },
      },
    ],
    lineItems: [
      { name: { tr: "Finansal Denetim", en: "Financial Audit" }, qty: 1, unit: 18000 },
      { name: { tr: "Operasyonel Değerlendirme", en: "Operational Assessment" }, qty: 1, unit: 10000 },
      { name: { tr: "Uyum ve Risk Değerlendirmesi", en: "Compliance & Risk Evaluation" }, qty: 1, unit: 9000 },
      { name: { tr: "Nihai Rapor ve Sunum", en: "Final Report & Presentation" }, qty: 1, unit: 4000 },
    ],
    contractText: {
      tr: "İşbu sözleşme, Denetçi tarafından Müşteri'ye sunulacak işletme denetimi hizmetlerinin genel çerçevesini, şartlarını ve kapsamını belirler.\n\nGizlilik: Taraflar, denetim kapsamında paylaşılan tüm finansal, ticari ve operasyonel bilgileri gizli tutar; yazılı onay olmaksızın üçüncü şahıslarla paylaşamaz.\n\nÜcretlendirme ve Ödeme Koşulları: Hizmet bedeli, kabul edilen fiyatlandırma teklifinde belirtildiği üzeredir. Fatura kesim tarihinden itibaren ödeme vadesi 15 (on beş) iş günüdür.\n\nSorumluluk: Denetçi, Müşteri tarafından sağlanan verilerin doğruluğuna dayanarak görüş bildirir; eksik veya hatalı bilgi kaynaklı sonuçlardan sorumlu tutulamaz.\n\nOnay: İşbu teklifin elektronik imza ile onaylanması, taraflar arasında kapsam, fiyatlandırma ve hizmet taahhütleri konusunda mutabakata varıldığını teyit eder.",
      en: "This agreement sets out the general framework, terms, and scope of the business audit services the Auditor will provide to the Client.\n\nConfidentiality: The parties treat all financial, commercial, and operational information shared during the audit as confidential and will not disclose it to third parties without written consent.\n\nFees & Payment Terms: Fees are as detailed in the accepted pricing proposal. Payment is due within 15 business days of the invoice date.\n\nLiability: The Auditor relies on the accuracy of data provided by the Client and is not liable for outcomes resulting from incomplete or incorrect information.\n\nApproval: Electronic signature approval of this proposal confirms mutual agreement between the parties on scope, pricing, and service commitments.",
    },
  },
  {
    id: "t14",
    name: { tr: "Kurumsal Yazılım & ERP Teklifi", en: "Enterprise Software Proposal" },
    category: { tr: "Kurumsal Yazılım", en: "Enterprise Software" },
    uses: 0,
    winRate: 0,
    accent: "var(--seg-2)",
    kind: "draft",
    sector: "enterprise_software",
    introText: {
      tr: "Sayın [Müşteri Yetkilisi],\n\n[Şirket Adı] bünyesindeki iş süreçlerini uçtan uca birleştirecek bir ERP (Kurumsal Kaynak Planlama) sistemine duyduğunuz ihtiyacı yakından değerlendirdik. Bu teklif, otomasyon, veri güvenliği ve süreç optimizasyonunu destekleyen, ölçeklenebilir ve sağlam bir ERP çözümünün tüm detaylarını içermektedir.\n\nAşağıda hedeflerimizi, hizmet kapsamımızı, ekibimizi ve şeffaf fiyatlandırmamızı bulabilirsiniz. Sorularınız için her zaman buradayız.",
      en: "Dear [Client Contact],\n\nWe've closely assessed [Company Name]'s need for an ERP (Enterprise Resource Planning) system to unify business processes end to end. This proposal covers every detail of a scalable, robust ERP solution that supports automation, data security, and process optimization.\n\nBelow you'll find our goals, scope of services, our team, and transparent pricing. We're always here for your questions.",
    },
    aboutText: {
      tr: "Kurumsal yazılım alanındaki uzmanlığımızı, sektörel deneyimimizi ve özelleştirilmiş kurumsal çözümler sunma taahhüdümüzü bir araya getiriyoruz. Sunduğumuz ERP çözümü, temel yazılım kurulumunun ötesine geçerek operasyonel verimliliği ve ekipler arası iş birliğini artıran kesintisiz bir çalışma ortamı yaratır.\n\n\"Uygulama sürecinde hem teknik derinlikleri hem de projeyi zamanında teslim etme disiplinleri bizi çok etkiledi.\" — [Referans Adı], [Unvan], [Referans Firma]",
      en: "We bring together deep enterprise software expertise, sector experience, and a commitment to delivering customized enterprise solutions. Our ERP offering goes beyond basic software implementation to create a seamless work environment that improves operational efficiency and cross-team collaboration.\n\n\"Both their technical depth and their discipline in delivering the project on time impressed us throughout implementation.\" — [Reference Name], [Title], [Reference Company]",
    },
    sections: [
      {
        title: { tr: "Hizmet Kapsamı", en: "Scope of Services" },
        body: {
          tr: "ERP sistemimiz, işletmenizin temel süreçlerini desteklemek üzere aşağıdaki bileşenleri kapsar:\n\n• Kurumsal Uygulama Entegrasyonu — mevcut sistemlerinizin ERP platformuyla sorunsuz şekilde entegre edilmesi.\n• Müşteri İlişkileri Yönetimi (CRM) — satış, pazarlama ve müşteri hizmetleri süreçlerinin tek bir platformda birleştirilmesi.\n• İş Zekası (Business Intelligence) — gerçek zamanlı raporlama ve analiz panelleri ile veriye dayalı karar desteği.\n• Muhasebe ve Finans Yönetimi — finansal süreçlerin otomasyonu ve raporlama standartlarına uyum.\n• Tedarik Zinciri Yönetimi (SCM) — stok, satın alma ve lojistik süreçlerinin uçtan uca takibi.\n• İçerik ve Ana Veri Yönetimi (MDM) — kurumsal verilerin tutarlı, tek bir kaynaktan yönetilmesi.\n\nTüm bileşenler, [Şirket Adı]'nın temel iş süreçlerini destekleyecek şekilde özelleştirilir.",
          en: "Our ERP system covers the following components to support your business's core processes:\n\n• Enterprise Application Integration — seamlessly connecting your existing systems with the ERP platform.\n• Customer Relationship Management (CRM) — unifying sales, marketing, and customer service processes on a single platform.\n• Business Intelligence — real-time reporting and analytics dashboards for data-driven decisions.\n• Accounting & Finance Management — automating financial processes and aligning with reporting standards.\n• Supply Chain Management (SCM) — end-to-end tracking of inventory, procurement, and logistics.\n• Content & Master Data Management (MDM) — managing enterprise data consistently from a single source of truth.\n\nAll components are customized to support [Company Name]'s core business processes.",
        },
      },
      {
        title: { tr: "Referans Projeler", en: "Case Studies" },
        body: {
          tr: "Daha önce tamamladığımız ERP uygulamalarından bazı örnekler:\n\n• [Referans Firma 1] — envanter görünürlüğünü artırarak stok maliyetlerinde %[X] azalma sağladı.\n• [Referans Firma 2] — manuel süreçlerin otomasyonuyla operasyonel işlem süresini %[X] kısalttı.\n• [Referans Firma 3] — entegre finans ve CRM modülleriyle raporlama süresini günler yerine saatlere indirdi.\n\nBu projeler, ölçülebilir sonuçlar (veri görünürlüğü, süreç otomasyonu, maliyet azaltımı) elde etme konusundaki tecrübemizi yansıtır.",
          en: "A few examples from ERP implementations we've completed:\n\n• [Reference Company 1] — reduced inventory carrying costs by [X]% through improved stock visibility.\n• [Reference Company 2] — cut operational processing time by [X]% by automating manual processes.\n• [Reference Company 3] — reduced reporting turnaround from days to hours with integrated finance and CRM modules.\n\nThese projects reflect our track record of delivering measurable results — data visibility, process automation, and cost reduction.",
        },
      },
      {
        title: { tr: "Ekibimiz", en: "Our Team" },
        body: {
          tr: "Projeyi yönetecek ekibimiz, ERP uygulama süreçlerinde deneyimli uzmanlardan oluşur:\n\n• [Yazılım Mimarı Adı] — ERP mimarisi ve sistem entegrasyonu konusunda [X] yıllık deneyime sahiptir.\n• [Proje Yöneticisi Adı] — uygulama sürecinin zaman çizelgesine ve kapsamına uygun şekilde yönetilmesinden sorumludur.\n• [Teknik Lider Adı] — özelleştirme, veri geçişi ve teknik entegrasyon süreçlerini yönetir.\n\nEkibimiz, uygulama süreci boyunca [Şirket Adı] ile yakın iş birliği içinde çalışır.",
          en: "The team managing this project consists of specialists experienced in ERP implementation:\n\n• [Software Architect Name] — [X] years of experience in ERP architecture and system integration.\n• [Project Manager Name] — responsible for managing the implementation on schedule and within scope.\n• [Technical Lead Name] — oversees customization, data migration, and technical integration.\n\nOur team works in close collaboration with [Company Name] throughout the implementation process.",
        },
      },
    ],
    lineItems: [
      { name: { tr: "ERP Kurulum ve Entegrasyon", en: "ERP Setup & Integration" }, qty: 1, unit: 65000 },
      { name: { tr: "Özelleştirme ve Modül Geliştirme (saatlik)", en: "Customization & Module Development (hourly)" }, qty: 120, unit: 950 },
      { name: { tr: "Veri Geçişi", en: "Data Migration" }, qty: 1, unit: 18000 },
      { name: { tr: "Kullanıcı Eğitimi", en: "User Training" }, qty: 1, unit: 9000 },
      { name: { tr: "Uygulama Sonrası Destek (aylık)", en: "Post-Implementation Support (monthly)" }, qty: 6, unit: 6000 },
    ],
    contractText: {
      tr: "İşbu sözleşme, Yüklenici tarafından Müşteri'ye sunulacak ERP uygulama hizmetlerinin genel çerçevesini, hizmet kapsamını ve ödeme takvimini belirler.\n\nGizlilik: Taraflar, proje kapsamında paylaşılan tüm ticari, finansal ve teknik bilgileri gizli bilgi olarak kabul eder; yazılı onay olmaksızın üçüncü şahıslarla paylaşamaz.\n\nÜcretlendirme ve Ödeme Koşulları: Hizmet bedeli, kabul edilen fiyatlandırma teklifinde belirtildiği üzeredir. Ödeme takvimi, uygulama aşamalarına bağlı olarak kilometre taşı bazlı belirlenir.\n\nKapsam Değişikliği: Kapsam dışı yeni talepler yazılı ek teklif ile ayrıca fiyatlandırılır.\n\nOnay: İşbu teklifin elektronik imza ile onaylanması, taraflar arasında kapsam, fiyatlandırma ve uygulama takvimi konusunda mutabakata varıldığını teyit eder ve uygulama sürecinin başlatılmasını sağlar.",
      en: "This agreement sets out the general framework, scope of services, and payment schedule for the ERP implementation services the Contractor will provide to the Client.\n\nConfidentiality: The parties treat all commercial, financial, and technical information shared during the project as confidential and will not disclose it to third parties without written consent.\n\nFees & Payment Terms: Fees are as detailed in the accepted pricing proposal. The payment schedule is milestone-based, tied to implementation phases.\n\nChange Requests: New requests outside scope are quoted and billed separately in writing.\n\nApproval: Electronic signature approval of this proposal confirms mutual agreement between the parties on scope, pricing, and the implementation timeline, and authorizes the implementation to begin.",
    },
  },
  {
    id: "t15",
    name: { tr: "Üst Düzey Yöneticilik Koçluğu / Yönetici Danışmanlığı Teklifi", en: "Executive Coaching / Leadership Advisory Proposal" },
    category: { tr: "Koçluk / Yönetici Danışmanlığı", en: "Coaching / Leadership Advisory" },
    uses: 0,
    winRate: 0,
    accent: "var(--seg-4)",
    kind: "draft",
    sector: "coaching",
    introText: {
      tr: "Sayın [Danışan Adı],\n\nTek kişilik bir faaliyetten bugünkü büyüyen işletmenize uzanan yolculuğunuz gerçekten takdire değer. Üst düzey yöneticilik koçluğu, bu yolculuğun mesleki gelişiminizdeki bir sonraki kritik adımı olabilir.\n\nBu teklifte, hem kişisel hem de ticari potansiyelinizi ortaya çıkarmanıza yardımcı olacak bir ortak, bir destekçi ve stratejik bir rehber olarak üstleneceğim rolü, koçluk sürecimizin nasıl işleyeceğini ve yatırımın detaylarını bulacaksınız.",
      en: "Dear [Client Name],\n\nYour journey from a one-person operation to the growing business you run today is genuinely admirable. Executive coaching can be the next critical step in that journey's professional development.\n\nIn this proposal you'll find the role I'll take on as a partner, a supporter, and a strategic guide to help unlock both your personal and business potential, how our coaching process will work, and the details of the investment.",
    },
    aboutText: {
      tr: "Solo girişimcilerden üst düzey yöneticilere kadar çok çeşitli danışanlarla çalışma konusunda engin bir deneyime sahibim. Yaklaşımım, kararlı liderlik ile güçlü, açık iletişimi bir araya getirir; danışanlarımın hem kendilerini hem de işlerini daha net görmelerine yardımcı olurum.\n\n\"Onunla çalışmak, kendi liderlik tarzımı yeniden keşfetmemi sağladı — hem işimde hem de kişisel hayatımda somut bir fark yarattı.\" — [Referans Adı], [Unvan], [Referans Firma]",
      en: "I bring extensive experience working with a wide range of clients, from solo entrepreneurs to senior executives. My approach combines decisive leadership with strong, open communication, helping clients see both themselves and their business more clearly.\n\n\"Working with them helped me rediscover my own leadership style — it made a tangible difference both in my business and in my personal life.\" — [Reference Name], [Title], [Reference Company]",
    },
    sections: [
      {
        title: { tr: "Koçluk Hedefleri", en: "Coaching Goals" },
        body: {
          tr: "İlk koçluk oturumumuzda, mesleki gelişiminize yönelik stratejik yaklaşımımızı birlikte netleştireceğiz. Bu bölüm, koçluk sürecinin hedeflerini, teslim edilecek unsurları ve hedeflerinize ulaşmayı bekleyebileceğiniz zaman çizelgesini özetler:\n\n• Netleştirilecek hedefler — [X] ay içinde ulaşılması hedeflenen kişisel ve ticari kilometre taşları.\n• Teslim edilecekler — düzenli oturum notları, gelişim değerlendirmeleri ve eylem planları.\n• Zaman çizelgesi — [X] aylık program boyunca aşamalı ilerleme takibi.",
          en: "In our first coaching session, we'll clarify together our strategic approach to your professional development. This section outlines the goals of the coaching process, the deliverables, and the timeline you can expect to reach your goals:\n\n• Goals to clarify — personal and business milestones targeted within [X] months.\n• Deliverables — regular session notes, progress assessments, and action plans.\n• Timeline — phased progress tracking over the [X]-month program.",
        },
      },
      {
        title: { tr: "Koçluk Nasıl İşler?", en: "How Coaching Works" },
        body: {
          tr: "Koçluk ilişkisinin temelinde güven yer alır. Süreç, tercihinize göre yüz yüze, telefon veya video konferans yoluyla gerçekleştirilebilecek esnek bire bir görüşmeleri içerir.\n\nEtkili koçluğun sonuçları arasında şunlar yer alır:\n• Daha net bir liderlik vizyonu ve karar alma özgüveni.\n• Kişisel ve profesyonel önceliklerin uyumlu hale getirilmesi.\n• Zorlayıcı durumlar karşısında sürdürülebilir stratejiler geliştirme becerisi.",
          en: "Trust is at the core of the coaching relationship. The process includes flexible one-on-one sessions that can take place in person, by phone, or via video conference, based on your preference.\n\nThe outcomes of effective coaching include:\n• A clearer leadership vision and confidence in decision-making.\n• Alignment between personal and professional priorities.\n• The ability to build sustainable strategies for facing challenging situations.",
        },
      },
      {
        title: { tr: "Koçluk Süreci", en: "Coaching Process" },
        body: {
          tr: "İlk ücretsiz görüşmeden 12 aylık kapsamlı koçluk planına kadar sürecimiz şu adımlardan oluşur:\n\n1. Keşif Toplantısı — hedeflerinizin ve mevcut durumunuzun ücretsiz olarak birlikte değerlendirilmesi.\n2. Değerlendirme — güçlü yönlerinizin ve karşılaştığınız zorlukların netleştirilmesi.\n3. Strateji Tasarımı — kişiselleştirilmiş bir koçluk planının oluşturulması.\n4. Sürekli Uygulama — düzenli takip oturumları ve ilerleme değerlendirmeleriyle desteklenen [X] aylık program.",
          en: "From the initial free consultation to a comprehensive 12-month coaching plan, our process consists of the following steps:\n\n1. Discovery Meeting — a free, joint assessment of your goals and current situation.\n2. Assessment — clarifying your strengths and the challenges you face.\n3. Strategy Design — building a personalized coaching plan.\n4. Ongoing Practice — a [X]-month program supported by regular follow-up sessions and progress reviews.",
        },
      },
    ],
    lineItems: [
      { name: { tr: "Keşif Görüşmesi", en: "Discovery Consultation" }, qty: 1, unit: 0 },
      { name: { tr: "Bire Bir Koçluk Oturumu (aylık)", en: "One-on-One Coaching Session (monthly)" }, qty: 12, unit: 3500 },
      { name: { tr: "Strateji Tasarımı ve Değerlendirme Raporu", en: "Strategy Design & Assessment Report" }, qty: 1, unit: 2500 },
    ],
    contractText: {
      tr: "İşbu sözleşme, Koç tarafından Danışan'a sunulacak üst düzey yöneticilik koçluğu hizmetlerinin genel çerçevesini belirler.\n\nSunulacak Hizmetler ve Toplantı Gereksinimleri: Koçluk oturumları, karşılıklı mutabakatla belirlenen sıklıkta ve süre boyunca gerçekleştirilir; Danışan'ın oturumlara düzenli katılımı, sürecin verimliliği için esastır.\n\nGizlilik: Koç, oturumlar sırasında paylaşılan tüm kişisel ve ticari bilgileri gizli tutar.\n\nİptal veya Değişiklik: Oturumların iptali veya yeniden planlanması, en az [X] saat önceden bildirilmelidir; aksi halde oturum ücreti tahsil edilir.\n\nOnay: İşbu teklifin elektronik imza ile onaylanması, taraflar arasında kapsam, ücretlendirme ve koçluk süreci konusunda mutabakata varıldığını teyit eder.",
      en: "This agreement sets out the general framework for the executive coaching services the Coach will provide to the Client.\n\nServices & Meeting Requirements: Coaching sessions take place at a frequency and duration set by mutual agreement; the Client's regular attendance is essential to the effectiveness of the process.\n\nConfidentiality: The Coach keeps all personal and business information shared during sessions confidential.\n\nCancellation or Rescheduling: Sessions must be cancelled or rescheduled with at least [X] hours' notice; otherwise the session fee is charged.\n\nApproval: Electronic signature approval of this proposal confirms mutual agreement between the parties on scope, fees, and the coaching process.",
    },
  },
  {
    id: "t16",
    name: { tr: "Finansal Hizmetler Teklifi", en: "Financial Services Proposal" },
    category: { tr: "Finansal Danışmanlık", en: "Financial Advisory" },
    uses: 0,
    winRate: 0,
    accent: "var(--seg-1)",
    kind: "draft",
    sector: "financial_services",
    introText: {
      tr: "Sayın [Müşteri Yetkilisi],\n\nTicari hedeflerinize ulaşmada stratejik finans yönetiminin taşıdığı önemi biliyoruz. Bu teklifte, [Şirket Adı]'nın finansal operasyonlarını genel iş stratejinizle uyumlu hale getirerek kârlılığı, büyümeyi ve sürdürülebilirliği en üst düzeye çıkarmaya yönelik yaklaşımımızın tüm detaylarını bulacaksınız.\n\nAşağıda ekibimizi, hizmet kapsamımızı ve şeffaf fiyatlandırmamızı bulabilirsiniz. Sorularınız için her zaman buradayız.",
      en: "Dear [Client Contact],\n\nWe understand how much strategic financial management matters to reaching your business goals. In this proposal you'll find our full approach to aligning [Company Name]'s financial operations with your overall business strategy to maximize profitability, growth, and sustainability.\n\nBelow you'll find our team, our scope of services, and transparent pricing. We're always here for your questions.",
    },
    aboutText: {
      tr: "Finansal İşler Direktörlüğü (CFO) hizmetleri ve finansal danışmanlık alanında uzmanlaşmış bir finansal hizmetler firmasıyız. Sektör deneyimimizi ve pazar bilgimizi, işletmelerin kaynaklarını optimize etmelerine yardımcı olacak özel finansal yönetim sistemleriyle birleştiriyoruz.\n\n\"Finansal görünürlüğümüzü tamamen değiştirdiler; artık yatırım kararlarını çok daha net verilerle alıyoruz.\" — [Referans Adı], [Unvan], [Referans Firma]",
      en: "We're a financial services firm specialized in CFO services and financial advisory. We combine our sector experience and market knowledge with custom financial management systems that help businesses optimize their resources.\n\n\"They completely transformed our financial visibility — we now make investment decisions with far clearer data.\" — [Reference Name], [Title], [Reference Company]",
    },
    sections: [
      {
        title: { tr: "Ekibimizle Tanışın", en: "Meet Our Team" },
        body: {
          tr: "Finans teklifinin sunulmasından sorumlu kilit profesyonellerimiz:\n\n• [Finans Stratejisti Adı] — iş planlaması ve uzun vadeli finansal strateji konusunda [X] yıllık deneyime sahiptir.\n• [Kıdemli Muhasebeci Adı], SMMM — vergi yönetimi ve finansal raporlama süreçlerini uçtan uca yönetir.\n• [Risk Danışmanı Adı] — risk değerlendirmesi ve mevzuata uyum konularında derin uzmanlığa sahiptir.\n\nEkibimiz, ihtiyaçlarınıza özel finansal çözümler geliştirmek için yakın iş birliği içinde çalışır.",
          en: "The key professionals responsible for delivering this financial proposal:\n\n• [Financial Strategist Name] — [X] years of experience in business planning and long-term financial strategy.\n• [Senior Accountant Name], CPA — manages tax administration and financial reporting processes end to end.\n• [Risk Advisor Name] — deep expertise in risk assessment and regulatory compliance.\n\nOur team works in close collaboration to develop financial solutions tailored to your needs.",
        },
      },
      {
        title: { tr: "Proje Özeti", en: "Project Summary" },
        body: {
          tr: "[Şirket Adı]'nın mevcut finansal tablosunu ve finansal hizmet hedeflerini özetler:\n\n• Kurumsal hedefler — büyüme, kârlılık ve sürdürülebilirlik önceliklerinin netleştirilmesi.\n• Finansal kaynak tahsisi ve bütçeleme stratejileri.\n• Uzun vadeli finansal planlama.\n\nLiderlik ekibinizle yakın çalışarak nakit akışını izler, yatırım kararlarını iyileştirir ve finansal istikrarınızı artırırız.",
          en: "Summarizes [Company Name]'s current financial picture and the goals for financial services:\n\n• Corporate goals — clarifying priorities around growth, profitability, and sustainability.\n• Financial resource allocation and budgeting strategies.\n• Long-term financial planning.\n\nWe work closely with your leadership team to monitor cash flow, improve investment decisions, and strengthen financial stability.",
        },
      },
      {
        title: { tr: "Teklif", en: "The Proposal" },
        body: {
          tr: "Sunduğumuz hizmetlerin ayrıntılı açıklaması:\n\n• Finansal Gözetim — mali tabloların düzenli takibi ve doğruluğunun sağlanması.\n• Gelir ve Gider Analizi — bütçeleme ve mevzuata uyum dahil.\n• Risk Yönetimi — finansal riskleri tespit etme, pazar dalgalanmalarını yönetme ve varlıklarınızı koruyacak risk azaltma stratejileri geliştirme.\n\nTüm hizmetler, işletmenizin büyüklüğüne ve ihtiyaçlarına göre özelleştirilir.",
          en: "A detailed description of the services we offer:\n\n• Financial Oversight — regular monitoring and accuracy checks of financial statements.\n• Income & Expense Analysis — including budgeting and regulatory compliance.\n• Risk Management — identifying financial risks, managing market volatility, and developing mitigation strategies to protect your assets and investments.\n\nAll services are customized to your business's size and needs.",
        },
      },
      {
        title: { tr: "Sonraki Adımlar", en: "Next Steps" },
        body: {
          tr: "1. İlk Görüşme — hedeflerinizin ve mevcut finansal durumunuzun değerlendirilmesi (Hafta 1).\n2. İşe Alım (Onboarding) — finansal verilerin aktarımı ve sistemlerin kurulumu (Hafta 2-3).\n3. Uygulama Planı — belirlenen hizmetlerin devreye alınması ve raporlama düzeninin başlatılması (Hafta 4).\n4. Sürekli Destek — düzenli raporlama, değerlendirme toplantıları ve süreç iyileştirmeleri.",
          en: "1. Initial Consultation — assessing your goals and current financial position (Week 1).\n2. Onboarding — transferring financial data and setting up systems (Weeks 2-3).\n3. Implementation Plan — rolling out the agreed services and starting the reporting cadence (Week 4).\n4. Ongoing Support — regular reporting, review meetings, and process improvements.",
        },
      },
    ],
    lineItems: [
      { name: { tr: "CFO Danışmanlığı (aylık)", en: "CFO Advisory (monthly)" }, qty: 12, unit: 15000 },
      { name: { tr: "Risk Değerlendirmesi", en: "Risk Assessment" }, qty: 1, unit: 12000 },
      { name: { tr: "Bütçeleme ve Uzun Vadeli Finansal Planlama", en: "Budgeting & Long-Term Financial Planning" }, qty: 1, unit: 9000 },
      { name: { tr: "Aylık Finansal Raporlama", en: "Monthly Financial Reporting" }, qty: 12, unit: 3500 },
    ],
    contractText: {
      tr: "İşbu sözleşme (nihai kullanımdan önce bir hukuk uzmanı tarafından incelenmesi önerilir), Firma tarafından Müşteri'ye sunulacak finansal danışmanlık ve CFO hizmetlerinin kapsamını, gizlilik ve standart yürütme kurallarını belirler.\n\nİş Kapsamı: Hizmetler, işbu teklifte belirtilen kapsamla sınırlıdır; kapsam dışı talepler ayrıca fiyatlandırılır.\n\nGizlilik: Taraflar, işbu sözleşme kapsamında paylaşılan tüm finansal ve ticari bilgileri gizli tutar; yazılı onay olmaksızın üçüncü şahıslarla paylaşamaz.\n\nÜcretlendirme ve Ödeme Koşulları: Hizmet bedeli, kabul edilen fiyatlandırma teklifinde belirtildiği üzeredir. Fatura kesim tarihinden itibaren ödeme vadesi 15 (on beş) iş günüdür.\n\nOnay: İşbu teklifin elektronik imza ile onaylanması, taraflar arasında kapsam, fiyatlandırma ve hizmet taahhütleri konusunda mutabakata varıldığını teyit eder.",
      en: "This agreement (recommended for review by legal counsel before final use) sets out the scope, confidentiality, and standard execution terms for the financial advisory and CFO services the Firm will provide to the Client.\n\nScope of Work: Services are limited to the scope stated in this proposal; requests outside scope are quoted separately.\n\nConfidentiality: The parties treat all financial and commercial information shared under this agreement as confidential and will not disclose it to third parties without written consent.\n\nFees & Payment Terms: Fees are as detailed in the accepted pricing proposal. Payment is due within 15 business days of the invoice date.\n\nApproval: Electronic signature approval of this proposal confirms mutual agreement between the parties on scope, pricing, and service commitments.",
    },
  },
  {
    id: "t17",
    name: { tr: "İnsan Kaynakları Danışmanlığı Teklifi", en: "HR Consulting Proposal" },
    category: { tr: "İnsan Kaynakları", en: "Human Resources" },
    uses: 0,
    winRate: 0,
    accent: "var(--seg-2)",
    kind: "draft",
    sector: "hr_consulting",
    introText: {
      tr: "Sayın [Müşteri Yetkilisi],\n\nBordro, yan haklar ve yasal mevzuata uyum yönetiminde işletmelerin karşılaştığı zorlukların farkındayız. İK hizmetlerini dış kaynak kullanarak almak; verimliliği artırır, mevzuata uyumu güvence altına alır ve çalışan memnuniyetini yükseltir.\n\nBu teklifte, modern İK teknolojilerini uzman danışmanlık hizmetleriyle birleştiren, [Şirket Adı]'nın ihtiyaçlarına özel bir İK çözümünün tüm detaylarını bulacaksınız.",
      en: "Dear [Client Contact],\n\nWe understand the challenges businesses face in managing payroll, benefits, and regulatory compliance. Outsourcing HR services increases efficiency, ensures compliance, and raises employee satisfaction.\n\nIn this proposal you'll find every detail of an HR solution tailored to [Company Name]'s needs, combining modern HR technology with expert advisory services.",
    },
    aboutText: {
      tr: "İK danışmanlığı alanında yılların verdiği tecrübeyle bordro ve yan haklar yönetimi sunuyoruz. Satış, idari işler, ilaç, bilişim, bankacılık, inşaat ve gayrimenkul gibi çok çeşitli sektörlerden müşterileri destekliyoruz. İş gücü planlaması, çalışan tutma ve yasal mevzuata uyum konularında ayrılmaz bir ortak olmayı hedefliyoruz.\n\n\"Bordro ve yan haklar süreçlerimizi devraldıktan sonra İK ekibimiz stratejik işlere daha fazla zaman ayırabildi.\" — [Referans Adı], [Unvan], [Referans Firma]",
      en: "With years of experience in HR consulting, we deliver payroll and benefits management. We support clients across a wide range of sectors — sales, administration, pharmaceuticals, technology, banking, construction, and real estate. Our goal is to be an indispensable partner in workforce planning, employee retention, and regulatory compliance.\n\n\"After they took over our payroll and benefits processes, our HR team could spend far more time on strategic work.\" — [Reference Name], [Title], [Reference Company]",
    },
    sections: [
      {
        title: { tr: "Ekibimiz", en: "Our Team" },
        body: {
          tr: "İK hizmetleri ekibimiz aşağıdaki uzmanlardan oluşur:\n\n• [Bordro Uzmanı Adı] — bordro işlemleri ve vergi beyanı konusunda [X] yıllık deneyime sahiptir.\n• [Yan Haklar Yöneticisi Adı] — sağlık, sigorta ve maluliyet yan haklarının yönetiminden sorumludur.\n• [İK Bilgi Sistemleri Uzmanı Adı] — entegre İK sistemlerinin kurulumu ve raporlama süreçlerini yönetir.\n\nHer ekip üyesi, size özelleştirilmiş ve etkili İK çözümleri sunmak için sektördeki engin deneyimini bir araya getirir.",
          en: "Our HR services team consists of the following specialists:\n\n• [Payroll Specialist Name] — [X] years of experience in payroll processing and tax filing.\n• [Benefits Manager Name] — responsible for managing health, insurance, and disability benefits.\n• [HR Information Systems Specialist Name] — manages the setup of integrated HR systems and reporting processes.\n\nEach team member brings extensive sector experience to deliver customized, effective HR solutions.",
        },
      },
      {
        title: { tr: "Nasıl Yardımcı Olabiliriz?", en: "How We Can Help" },
        body: {
          tr: "• Entegre İK Bilgi Sistemi — kolay çevrim içi erişim ve ayrıntılı İK raporları sunarak bordro ve yan haklar yönetimini kolaylaştırır.\n• Yan Haklar İdaresi — çalışanların sağlık, sigorta ve maluliyet yönetimini kapsar; yasal uyumu ve maliyet takibini sağlar.\n• Bordro Hizmetleri — doğrudan yatırma (EFT), vergi beyanı, devam takibi ve yeni işe alım bildirimini içerir.\n\nBu çözümler, işletmenizin iş gücü yönetimini verimli bir şekilde optimize etmesine yardımcı olur.",
          en: "• Integrated HR Information System — simplifies payroll and benefits management with easy online access and detailed HR reports.\n• Benefits Administration — covers employee health, insurance, and disability management; ensures compliance and cost tracking.\n• Payroll Services — includes direct deposit, tax filing, attendance tracking, and new-hire reporting.\n\nThese solutions help your business optimize workforce management efficiently.",
        },
      },
      {
        title: { tr: "Sonraki Adımlar", en: "Next Steps" },
        body: {
          tr: "1. Teklifin İncelenmesi — hizmet kapsamının ve paketlerin birlikte gözden geçirilmesi.\n2. Uygun Paketin Seçilmesi — ihtiyaçlarınıza en uygun hizmet katmanının belirlenmesi.\n3. Başlangıç (Kickoff) Toplantısı — uygulama takviminin ve sorumlulukların netleştirilmesi.\n\nÖzel İK ihtiyaçlarınızı daha ayrıntılı görüşmek üzere bir toplantı planlamanızı öneririz.",
          en: "1. Reviewing the Proposal — jointly reviewing the scope of services and packages.\n2. Selecting the Right Package — determining the service tier best suited to your needs.\n3. Kickoff Meeting — clarifying the implementation timeline and responsibilities.\n\nWe recommend scheduling a meeting to discuss your specific HR needs in more detail.",
        },
      },
    ],
    lineItems: [
      { name: { tr: "Bronz Paket — Bordro & Yan Haklar Yönetimi (aylık, 20 saat)", en: "Bronze Package — Payroll & Benefits Management (monthly, 20 hours)" }, qty: 12, unit: 6000 },
      { name: { tr: "Gümüş Paket — Entegre İK Sistemi Erişimi (aylık)", en: "Silver Package — Integrated HR System Access (monthly)" }, qty: 12, unit: 9500 },
      { name: { tr: "Altın Paket — Çalışan Oryantasyon Oturumları Dahil (aylık)", en: "Gold Package — Includes Employee Orientation Sessions (monthly)" }, qty: 12, unit: 14000 },
      { name: { tr: "Ofis Dışı İK Desteği (saatlik)", en: "Off-Site HR Support (hourly)" }, qty: 10, unit: 850 },
    ],
    contractText: {
      tr: "İşbu sözleşme, Firma tarafından Müşteri'ye sunulacak İK danışmanlığı hizmetlerinin genel çerçevesini belirler. Hiçbir İK zorluğu, ekibimizin üstesinden gelemeyeceği kadar karmaşık değildir.\n\nGizlilik: Taraflar, işbu sözleşme kapsamında paylaşılan tüm çalışan ve ticari bilgileri gizli tutar; yazılı onay olmaksızın üçüncü şahıslarla paylaşamaz.\n\nÜcretlendirme ve Ödeme Koşulları: Hizmet bedeli, seçilen pakete göre belirlenir. Fatura kesim tarihinden itibaren ödeme vadesi 15 (on beş) iş günüdür.\n\nFesih Şartları: Taraflardan herhangi biri, 30 (otuz) gün önceden yazılı bildirimde bulunmak kaydıyla işbu sözleşmeyi tek taraflı olarak feshedebilir.\n\nOnay: İşbu teklifin elektronik imza ile onaylanması, taraflar arasında kapsam, fiyatlandırma ve hizmet taahhütleri konusunda mutabakata varıldığını teyit eder ve İK hizmetlerinin başlatılmasını sağlar. Özel ihtiyaçlarınızı görüşmek üzere bir toplantı planlamanızı öneririz.",
      en: "This agreement sets out the general framework for the HR consulting services the Firm will provide to the Client. No HR challenge is too complex for our team.\n\nConfidentiality: The parties treat all employee and business information shared under this agreement as confidential and will not disclose it to third parties without written consent.\n\nFees & Payment Terms: Fees are set according to the selected package. Payment is due within 15 business days of the invoice date.\n\nTermination: Either party may terminate this agreement unilaterally with 30 days' written notice.\n\nApproval: Electronic signature approval of this proposal confirms mutual agreement between the parties on scope, pricing, and service commitments, and authorizes HR services to begin. We recommend scheduling a meeting to discuss your specific needs.",
    },
  },
  {
    id: "t18",
    name: { tr: "Pazar Araştırması Teklifi", en: "Market Research Proposal" },
    category: { tr: "Pazar Araştırması", en: "Market Research" },
    uses: 0,
    winRate: 0,
    accent: "var(--seg-3)",
    kind: "draft",
    sector: "market_research",
    introText: {
      tr: "Sayın [Müşteri Yetkilisi],\n\nBu teklif, [Şirket Adı] için ideal hedef kitlenizin kim olduğunu, bu kitlenin nerede bulunduğunu ve kararlarını nelerin yönlendirdiğini ortaya çıkaracak pazar araştırması projesinin amacını ve kapsamını açıklar. Amacımız, ekibinize etkili pazarlama için net ve uygulanabilir bir yol haritası sunmaktır.\n\nAşağıda araştırma sürecimizi, ekibimizi ve şeffaf fiyatlandırmamızı bulabilirsiniz. Sorularınız için her zaman buradayız.",
      en: "Dear [Client Contact],\n\nThis proposal outlines the purpose and scope of a market research project for [Company Name] that will uncover who your ideal target audience is, where they can be found, and what drives their decisions. Our goal is to give your team a clear, actionable roadmap for effective marketing.\n\nBelow you'll find our research process, our team, and transparent pricing. We're always here for your questions.",
    },
    aboutText: {
      tr: "Titiz ve pratik araştırmalara olan bağlılığımızla tanınıyoruz. Derin merak ve stratejik düşünceyi bir araya getirerek verileri sonuç getiren içgörülere dönüştürüyoruz.\n\nTüm araştırmalarımız katılımcı onayıyla yürütülür ve veri gizliliği proje boyunca titizlikle korunur; katı etik kurallara bağlı kalırız.\n\n\"Sundukları içgörüler sayesinde niş kitlemizle çok daha güçlü bağ kurduk ve dönüşüm oranlarımız belirgin şekilde arttı.\" — [Referans Adı], [Unvan], [Referans Firma]",
      en: "We're known for our commitment to rigorous, practical research. We combine deep curiosity with strategic thinking to turn data into insights that drive results.\n\nAll our research is conducted with participant consent, and data privacy is carefully protected throughout the project; we adhere to strict ethical standards.\n\n\"Their insights helped us connect far more strongly with our niche audience, and our conversion rates rose noticeably.\" — [Reference Name], [Title], [Reference Company]",
    },
    sections: [
      {
        title: { tr: "Araştırma Süreci", en: "Research Process" },
        body: {
          tr: "1. Dahili Veri İncelemesi — mevcut müşteri tabanınızı anlamak için elinizdeki verilerin analiz edilmesi.\n2. Temel Araştırma Sorularının Belirlenmesi — projeye yön verecek net soruların oluşturulması.\n3. Dış Çevre Analizi — demografik bilgiler, davranış eğilimleri ve rakip analizinin incelenmesi.\n4. Raporlama — tüm bulguların, pazarlama stratejinize yön verecek uygulanabilir içgörüler içeren özel bir raporda toplanması.",
          en: "1. Internal Data Review — analyzing your existing data to understand your current customer base.\n2. Defining Core Research Questions — establishing clear questions to guide the project.\n3. External Landscape Analysis — examining demographics, behavioral trends, and competitors.\n4. Reporting — compiling all findings into a custom report with actionable insights to guide your marketing strategy.",
        },
      },
      {
        title: { tr: "Ekibimiz", en: "Our Team" },
        body: {
          tr: "Bu projenin arkasındaki araştırmacılar ve stratejistler:\n\n• [Baş Araştırmacı Adı] — pazar araştırması ve veri analizi konusunda [X] yıllık deneyime sahiptir.\n• [Pazarlama Stratejisti Adı] — araştırma bulgularını uygulanabilir pazarlama stratejilerine dönüştürür.\n• [Veri Analisti Adı] — demografik ve davranışsal verilerin analizinden sorumludur.\n\nEkibimiz, her projeye analitik ve yaratıcı uzmanlığın bir karışımını taşır.",
          en: "The researchers and strategists behind this project:\n\n• [Lead Researcher Name] — [X] years of experience in market research and data analysis.\n• [Marketing Strategist Name] — turns research findings into actionable marketing strategies.\n• [Data Analyst Name] — responsible for analyzing demographic and behavioral data.\n\nOur team brings a blend of analytical and creative expertise to every project.",
        },
      },
    ],
    lineItems: [
      { name: { tr: "Dahili Veri İncelemesi & Araştırma Soruları", en: "Internal Data Review & Research Questions" }, qty: 1, unit: 7000 },
      { name: { tr: "Dış Çevre ve Rakip Analizi", en: "External Landscape & Competitor Analysis" }, qty: 1, unit: 11000 },
      { name: { tr: "Saha Araştırması (anket/görüşme)", en: "Field Research (survey/interviews)" }, qty: 1, unit: 9000 },
      { name: { tr: "Nihai Rapor ve Sunum", en: "Final Report & Presentation" }, qty: 1, unit: 5000 },
    ],
    contractText: {
      tr: "İşbu iş tanımı belgesi ve sözleşme, Araştırma Firması tarafından Müşteri'ye sunulacak pazar araştırması hizmetlerinin kapsamını ve tarafların sorumluluklarını belirler.\n\nTeslim Edilecekler ve Sorumluluklar: Her aşamada teslim edilecek raporlar ve bulgular, işbu teklifte belirtilen zaman çizelgesine göre sunulur; Müşteri, gerekli iç verileri ve geri bildirimleri zamanında sağlamakla yükümlüdür.\n\nGizlilik ve Etik: Tüm araştırmalar katılımcı onayıyla yürütülür; veri gizliliği titizlikle korunur ve yalnızca bu proje kapsamında kullanılır.\n\nİptal ve Değişiklik: Proje kapsamındaki değişiklik talepleri yazılı olarak bildirilmeli ve ayrıca fiyatlandırılmalıdır; başlangıç tarihinden [X] gün öncesine kadar yapılan iptallerde kapora iadesi yapılmaz.\n\nOnay: İşbu teklifin elektronik imza ile onaylanması, taraflar arasında kapsam, fiyatlandırma ve iş birliği beklentileri konusunda mutabakata varıldığını teyit eder ve açılış toplantısının planlanmasını sağlar.",
      en: "This statement of work and agreement sets out the scope of the market research services the Research Firm will provide to the Client and the responsibilities of each party.\n\nDeliverables & Responsibilities: Reports and findings for each phase are delivered according to the timeline stated in this proposal; the Client is responsible for providing necessary internal data and feedback in a timely manner.\n\nConfidentiality & Ethics: All research is conducted with participant consent; data privacy is carefully protected and used solely for this project.\n\nCancellation & Changes: Change requests within the project scope must be submitted in writing and are priced separately; deposits are non-refundable for cancellations made within [X] days of the start date.\n\nApproval: Electronic signature approval of this proposal confirms mutual agreement between the parties on scope, pricing, and collaboration expectations, and enables scheduling of the kickoff meeting.",
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
