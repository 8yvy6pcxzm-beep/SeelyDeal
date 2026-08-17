import { NextResponse } from "next/server";
import {
  renderToBuffer,
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
  Svg,
  Defs,
  LinearGradient,
  Stop,
  Rect,
} from "@react-pdf/renderer";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";
import appConfig from "@/app.config";
import React from "react";
import path from "node:path";

// Helvetica has no Turkish glyphs (Ş, ı, İ render as garbage) — use a Unicode font instead.
Font.register({
  family: "Inter",
  fonts: [
    { src: path.join(process.cwd(), "fonts", "Inter-Regular.ttf"), fontWeight: 400 },
    { src: path.join(process.cwd(), "fonts", "Inter-Bold.ttf"), fontWeight: 700 },
  ],
});
// react-pdf's own hyphenation callback breaks mid-word for Turkish text (no
// TR dictionary) — disable it so long words wrap on spaces instead.
Font.registerHyphenationCallback((word) => [word]);

// Colors that don't move with the brand theme — kept out of createStyles so
// they aren't recomputed per proposal.
const NEUTRAL = {
  border: "#ECEBF1",
  soft: "#FAFAFC",
  ink: "#1a1c1a",
  body: "#333",
  muted: "#555",
  faint: "#888",
  hairline: "#eee",
};

// Styles that depend on the proposal's theme (brand color). Everything else
// (spacing, type scale, structural layout) is theme-independent and lives in
// the static `styles` sheet below.
function createThemedStyles(primary: string, accent: string) {
  return StyleSheet.create({
    h2Bar: { width: 3, height: 10, backgroundColor: primary, borderRadius: 2 },
    h2: { fontSize: 9.5, fontWeight: 700, color: primary, textTransform: "uppercase", letterSpacing: 0.5 },
    checkMark: { fontSize: 8.5, color: primary, fontWeight: 700 },
    pkgBox: {
      borderWidth: 1,
      borderLeftWidth: 3,
      borderColor: NEUTRAL.border,
      borderLeftColor: primary,
      borderRadius: 8,
      padding: 12,
      backgroundColor: mixWithWhite(primary, 0.04),
    },
    rowAlt: { backgroundColor: mixWithWhite(primary, 0.05) },
    totalLabel: { fontSize: 11, fontWeight: 700, color: "#fff" },
    auditHeaderCell: { fontSize: 7.5, fontWeight: 700, color: primary, textTransform: "uppercase" },
    coverBrand: { fontSize: 10.5, fontWeight: 700, marginBottom: 10, letterSpacing: 0.5, color: "#fff" },
    metaValue: { fontSize: 9.5, fontWeight: 700, marginTop: 2, color: "#fff" },
    accentDot: { color: accent },
  });
}

// Cheap "mix a brand hex with white" for subtle tinted backgrounds — avoids
// pulling in a color library just for this. Falls back to a flat tint if the
// input isn't a plain #rrggbb hex (e.g. an oklch/rgba string from theme_json).
function mixWithWhite(hex: string, amount: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(91,61,246,${amount})`;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${amount})`;
}

const styles = StyleSheet.create({
  page: { padding: 0, fontSize: 9.5, fontFamily: "Inter", color: NEUTRAL.ink },
  cover: { position: "relative", padding: 24, minHeight: 140 },
  coverBg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  coverLogo: { height: 22, marginBottom: 8, objectFit: "contain" },
  title: { fontSize: 19, fontWeight: 700, marginBottom: 3, color: "#fff" },
  client: { fontSize: 10, color: "#eee", marginBottom: 10 },
  metaCard: {
    flexDirection: "row",
    gap: 18,
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  metaLabel: { fontSize: 7, color: "rgba(255,255,255,0.75)", textTransform: "uppercase", letterSpacing: 0.5 },
  body: { padding: 32, paddingTop: 14, paddingBottom: 40 },
  section: { marginTop: 12 },
  h2Row: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  text: { lineHeight: 1.35, fontSize: 9, color: NEUTRAL.body },
  checkRow: { flexDirection: "row", gap: 6, marginBottom: 5 },
  checkTitle: { fontSize: 9, fontWeight: 700 },
  checkBody: { fontSize: 8.5, color: NEUTRAL.muted, marginTop: 1, lineHeight: 1.3 },
  partiesRow: { flexDirection: "row", gap: 10 },
  partyBox: { flex: 1, borderWidth: 1, borderColor: NEUTRAL.border, borderRadius: 8, padding: 10, backgroundColor: NEUTRAL.soft },
  partyLabel: { fontSize: 7, color: NEUTRAL.faint, textTransform: "uppercase", marginBottom: 3, letterSpacing: 0.5 },
  partyName: { fontSize: 9, fontWeight: 700 },
  partyLine: { fontSize: 8, color: "#666", marginTop: 1 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: NEUTRAL.hairline },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    padding: 10,
    borderRadius: 6,
    backgroundColor: "#1e293b",
  },
  clauseBox: { flexDirection: "row", gap: 8, marginTop: 5 },
  clauseBar: { width: 2, backgroundColor: NEUTRAL.border, borderRadius: 1 },
  clause: { fontSize: 8, color: NEUTRAL.muted, lineHeight: 1.3, flex: 1 },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: NEUTRAL.hairline,
    paddingTop: 8,
    paddingHorizontal: 16,
    textAlign: "center",
    fontSize: 7.5,
    color: NEUTRAL.faint,
  },
  auditTable: { borderWidth: 1, borderColor: NEUTRAL.border, borderRadius: 8, marginTop: 4, overflow: "hidden" },
  auditHeaderRow: { flexDirection: "row", backgroundColor: NEUTRAL.soft, borderBottomWidth: 1, borderBottomColor: NEUTRAL.border },
  auditRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: NEUTRAL.hairline },
  auditRowAlt: { backgroundColor: NEUTRAL.soft },
  auditCellRole: { width: "16%", padding: 5, fontSize: 8 },
  auditCellSigner: { width: "26%", padding: 5, fontSize: 8 },
  auditCellIp: { width: "18%", padding: 5, fontSize: 8 },
  auditCellTime: { width: "24%", padding: 5, fontSize: 8 },
  auditCellOtp: { width: "16%", padding: 5, fontSize: 8 },
  auditEmpty: { fontSize: 8.5, color: NEUTRAL.faint, marginTop: 8 },
  auditNoteBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    padding: 10,
    borderRadius: 6,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  auditNoteMark: { fontSize: 10, color: "#16a34a", fontWeight: 700 },
  auditNote: { fontSize: 8, color: "#166534", lineHeight: 1.3, flex: 1 },
});

function splitClauses(text: string): string[] {
  const parts = text.split(/\n?(?=\d+\.\s)/).map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [text];
}

function h2El(label: string, theme: ReturnType<typeof createThemedStyles>) {
  return React.createElement(
    View,
    { style: styles.h2Row, wrap: false },
    React.createElement(View, { style: theme.h2Bar }),
    React.createElement(Text, { style: theme.h2 }, label),
  );
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket bulunamadı." }, { status: 404 });

  const { data: proposal } = await service
    .from("proposals")
    .select("*, clients(name), companies(name, primary_color, email, logo_url, address, phone, plan)")
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .maybeSingle();

  if (!proposal) return NextResponse.json({ error: "Teklif bulunamadı." }, { status: 404 });

  const { data: blockSignatures } = await service
    .from("block_signatures")
    .select("block_id, block_type, signer_role, signer_name, signer_email, otp_verified, ip, signed_at")
    .eq("proposal_id", id)
    .order("signed_at", { ascending: true });

  const lineItems: { name: string; qty: number; unit: number; optional?: boolean; included?: boolean }[] = proposal.line_items || [];
  const billingOptions: { key: string; label: { tr: string; en: string }; price: number }[] = proposal.billing_options || [];
  const allSections: { title: string; body: string; condition?: { lineItem?: string; billingKey?: string } }[] = proposal.sections || [];
  // A section bound to a lineItem or billingKey only prints while that exact choice is the one on record for this proposal.
  const sections = allSections.filter((s) => {
    if (!s.condition) return true;
    if (s.condition.lineItem) {
      const li = lineItems.find((it) => it.name === s.condition!.lineItem);
      return !!li && (!li.optional || !!li.included);
    }
    if (s.condition.billingKey) return proposal.selected_billing === s.condition.billingKey;
    return true;
  });
  const nextSteps: { title: string; body: string }[] = proposal.next_steps || [];
  const client: Record<string, string> = proposal.client_contact || {};
  const company = proposal.companies;

  // Same resolution order as the public HTML page: per-proposal theme first,
  // then the company brand color, then the app default.
  const theme = (proposal.theme_json || {}) as { primaryColor?: string; accentColor?: string };
  const brandColor = theme.primaryColor || company?.primary_color || "#5b3df6";
  const accentColor = theme.accentColor || brandColor;
  const t = createThemedStyles(brandColor, accentColor);

  const total = lineItems.reduce((s, li) => (li.optional && !li.included ? s : s + li.qty * li.unit), 0);
  const validDays = proposal.valid_days || 15;
  const createdDate = new Date(proposal.created_at).toLocaleDateString("tr-TR");

  // Audit rows: the whole-proposal "Accept & Sign" event (proposals.signed_at/…)
  // plus every per-block signature (block_signatures — see ../blocks/[blockId]/sign
  // and ../blocks/[blockId]/company-sign). OTP is only required above the Lite plan.
  const otpRequiredForProposal = (proposal.companies as { plan?: string } | null)?.plan !== "lite";
  const auditRows: {
    role: string;
    signer: string;
    ip: string;
    time: string;
    otp: string;
  }[] = [];
  if (proposal.signed_at) {
    auditRows.push({
      role: "Müşteri — Teklif Onayı",
      signer: proposal.signed_by_name || "—",
      ip: proposal.signed_ip || "—",
      time: new Date(proposal.signed_at).toLocaleString("tr-TR"),
      otp: otpRequiredForProposal ? "Doğrulandı" : "Gerekli değil (Lite)",
    });
  }
  for (const s of (blockSignatures ?? []) as {
    block_type: string;
    signer_role: string;
    signer_name: string;
    signer_email: string | null;
    otp_verified: boolean;
    ip: string | null;
    signed_at: string;
  }[]) {
    const blockLabel = s.block_type === "Legal" ? "Yasal Madde" : "Sözleşme";
    auditRows.push({
      role: `${s.signer_role === "company" ? "Şirket" : "Müşteri"} — ${blockLabel}`,
      signer: s.signer_email ? `${s.signer_name} (${s.signer_email})` : s.signer_name,
      ip: s.ip || "—",
      time: new Date(s.signed_at).toLocaleString("tr-TR"),
      otp: s.otp_verified ? "Doğrulandı" : "Gerekli değil",
    });
  }

  const doc = React.createElement(
    Document,
    {},
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      // Cover
      React.createElement(
        View,
        { style: styles.cover, wrap: false },
        React.createElement(
          Svg,
          { style: styles.coverBg, width: "100%", height: "100%", viewBox: "0 0 600 320", preserveAspectRatio: "none" },
          React.createElement(
            Defs,
            {},
            React.createElement(
              LinearGradient,
              { id: "coverGrad", x1: "0", y1: "0", x2: "1", y2: "1" },
              React.createElement(Stop, { offset: "0", stopColor: brandColor, stopOpacity: 1 }),
              React.createElement(Stop, { offset: "1", stopColor: accentColor, stopOpacity: 1 }),
            ),
          ),
          React.createElement(Rect, { x: "0", y: "0", width: "600", height: "320", fill: "url(#coverGrad)" }),
        ),
        company?.logo_url ? React.createElement(Image, { style: styles.coverLogo, src: company.logo_url }) : null,
        React.createElement(Text, { style: t.coverBrand }, company?.name ?? appConfig.name),
        React.createElement(Text, { style: styles.title }, proposal.title),
        React.createElement(Text, { style: styles.client }, proposal.clients?.name ?? ""),
        React.createElement(
          View,
          { style: styles.metaCard },
          React.createElement(
            View,
            {},
            React.createElement(Text, { style: styles.metaLabel }, "Hazırlayan"),
            React.createElement(Text, { style: t.metaValue }, company?.name ?? ""),
          ),
          React.createElement(
            View,
            {},
            React.createElement(Text, { style: styles.metaLabel }, "Muhatap"),
            React.createElement(Text, { style: t.metaValue }, client.contactName || proposal.clients?.name || "—"),
          ),
          React.createElement(
            View,
            {},
            React.createElement(Text, { style: styles.metaLabel }, "Teklif Tarihi"),
            React.createElement(Text, { style: t.metaValue }, createdDate),
          ),
          React.createElement(
            View,
            {},
            React.createElement(Text, { style: styles.metaLabel }, "Geçerlilik"),
            React.createElement(Text, { style: t.metaValue }, `${validDays} gün`),
          ),
        ),
      ),

      React.createElement(
        View,
        { style: styles.body },

        // Ön yazı
        proposal.intro_text
          ? React.createElement(
              View,
              { style: styles.section },
              h2El("Ön Yazı", t),
              React.createElement(Text, { style: styles.text }, proposal.intro_text),
            )
          : null,

        // Hakkımızda
        proposal.about_text
          ? React.createElement(
              View,
              { style: styles.section },
              h2El("Hakkımızda", t),
              React.createElement(Text, { style: styles.text }, proposal.about_text),
            )
          : null,

        // Taraflar
        React.createElement(
          View,
          { style: styles.section },
          h2El("Taraflar", t),
          React.createElement(
            View,
            { style: styles.partiesRow, wrap: false },
            React.createElement(
              View,
              { style: styles.partyBox },
              React.createElement(Text, { style: styles.partyLabel }, "Hizmeti Sunan"),
              React.createElement(Text, { style: styles.partyName }, company?.name ?? ""),
              company?.address ? React.createElement(Text, { style: styles.partyLine }, company.address) : null,
              company?.phone ? React.createElement(Text, { style: styles.partyLine }, company.phone) : null,
              company?.email ? React.createElement(Text, { style: styles.partyLine }, company.email) : null,
              React.createElement(Text, { style: styles.partyLine }, appConfig.domain),
            ),
            React.createElement(
              View,
              { style: styles.partyBox },
              React.createElement(Text, { style: styles.partyLabel }, "Hizmeti Alan"),
              React.createElement(Text, { style: styles.partyName }, client.company || proposal.clients?.name || ""),
              client.contactName
                ? React.createElement(Text, { style: styles.partyLine }, `${client.contactName}${client.title ? ` — ${client.title}` : ""}`)
                : null,
              client.address ? React.createElement(Text, { style: styles.partyLine }, client.address) : null,
              client.phone ? React.createElement(Text, { style: styles.partyLine }, client.phone) : null,
              client.email ? React.createElement(Text, { style: styles.partyLine }, client.email) : null,
            ),
          ),
        ),

        // Hizmet kapsamı — each row wraps independently so a page break lands
        // between items, never mid-item, and the section header never gets
        // stranded alone at the bottom of a page.
        sections.length > 0
          ? React.createElement(
              View,
              { style: styles.section },
              h2El("Hizmet Kapsamı", t),
              ...sections.map((s, i) =>
                React.createElement(
                  View,
                  { key: i, style: styles.checkRow, wrap: false },
                  React.createElement(Text, { style: t.checkMark }, "✓"),
                  React.createElement(
                    View,
                    {},
                    React.createElement(Text, { style: styles.checkTitle }, s.title),
                    React.createElement(Text, { style: styles.checkBody }, s.body),
                  ),
                ),
              ),
            )
          : null,

        // Paket ve ücret
        lineItems.length > 0 || billingOptions.length > 0
          ? React.createElement(
              View,
              { style: styles.section },
              h2El("Paket ve Ücret", t),
              React.createElement(
                View,
                { style: t.pkgBox },
                ...billingOptions.map((o, i) =>
                  React.createElement(
                    Text,
                    { key: `b${i}`, style: { fontSize: 9, fontWeight: 700, marginBottom: 3 } },
                    `${o.label.tr}: $${o.price.toLocaleString()}`,
                  ),
                ),
                ...lineItems.map((li, i) =>
                  React.createElement(
                    View,
                    { key: i, style: i % 2 === 1 ? [styles.row, t.rowAlt] : styles.row, wrap: false },
                    React.createElement(Text, {}, `${li.name} × ${li.qty}${li.optional ? " (opsiyonel)" : ""}`),
                    React.createElement(Text, {}, `$${(li.optional && !li.included ? 0 : li.unit * li.qty).toLocaleString()}`),
                  ),
                ),
                lineItems.length > 0
                  ? React.createElement(
                      View,
                      { style: styles.totalRow, wrap: false },
                      React.createElement(Text, { style: t.totalLabel }, "Toplam"),
                      React.createElement(Text, { style: t.totalLabel }, `$${total.toLocaleString()}`),
                    )
                  : null,
              ),
            )
          : null,

        // Sözleşme koşulları — each clause wraps independently, same reasoning
        // as the scope checklist above.
        proposal.contract_text
          ? React.createElement(
              View,
              { style: styles.section },
              h2El("Sözleşme Koşulları", t),
              ...splitClauses(proposal.contract_text).map((c: string, i: number) =>
                React.createElement(
                  View,
                  { key: i, style: styles.clauseBox, wrap: false },
                  React.createElement(View, { style: styles.clauseBar }),
                  React.createElement(Text, { style: styles.clause }, c),
                ),
              ),
            )
          : null,

        // Sonraki adımlar
        nextSteps.length > 0
          ? React.createElement(
              View,
              { style: styles.section },
              h2El("Sonraki Adımlar", t),
              ...nextSteps.map((step, i) =>
                React.createElement(
                  View,
                  { key: i, style: styles.checkRow, wrap: false },
                  React.createElement(Text, { style: t.checkMark }, "✓"),
                  React.createElement(
                    View,
                    {},
                    React.createElement(Text, { style: styles.checkTitle }, `${i + 1}. ${step.title}`),
                    React.createElement(Text, { style: styles.checkBody }, step.body),
                  ),
                ),
              ),
            )
          : null,
      ),

      React.createElement(Text, {
        style: styles.footer,
        fixed: true,
        render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
          `${appConfig.name} — ${company?.name ?? ""} · Bu teklif ${createdDate} tarihinden itibaren ${validDays} gün geçerlidir. · Sayfa ${pageNumber} / ${totalPages}`,
      }),
    ),

    // İmza ve Denetim İzi (Audit Trail) — last page, every signature event on record
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(
        View,
        { style: styles.body },
        h2El("İmza ve Denetim İzi (Audit Trail)", t),
        auditRows.length === 0
          ? React.createElement(Text, { style: styles.auditEmpty }, "Bu teklif için henüz kayıtlı bir imza yok.")
          : React.createElement(
              View,
              { style: styles.auditTable },
              React.createElement(
                View,
                { style: styles.auditHeaderRow },
                React.createElement(Text, { style: [styles.auditCellRole, t.auditHeaderCell] }, "Rol"),
                React.createElement(Text, { style: [styles.auditCellSigner, t.auditHeaderCell] }, "İsim / E-posta"),
                React.createElement(Text, { style: [styles.auditCellIp, t.auditHeaderCell] }, "IP Adresi"),
                React.createElement(Text, { style: [styles.auditCellTime, t.auditHeaderCell] }, "Zaman Damgası"),
                React.createElement(Text, { style: [styles.auditCellOtp, t.auditHeaderCell] }, "OTP Doğrulama"),
              ),
              ...auditRows.map((r, i) =>
                React.createElement(
                  View,
                  { key: i, style: i % 2 === 1 ? [styles.auditRow, styles.auditRowAlt] : styles.auditRow, wrap: false },
                  React.createElement(Text, { style: styles.auditCellRole }, r.role),
                  React.createElement(Text, { style: styles.auditCellSigner }, r.signer),
                  React.createElement(Text, { style: styles.auditCellIp }, r.ip),
                  React.createElement(Text, { style: styles.auditCellTime }, r.time),
                  React.createElement(Text, { style: styles.auditCellOtp }, r.otp),
                ),
              ),
            ),
        React.createElement(
          View,
          { style: styles.auditNoteBox, wrap: false },
          React.createElement(Text, { style: styles.auditNoteMark }, "✓"),
          React.createElement(
            Text,
            { style: styles.auditNote },
            "Bu doküman elektronik olarak imzalanmış ve doğrulama izleri saklanmıştır.",
          ),
        ),
      ),
      React.createElement(Text, {
        style: styles.footer,
        fixed: true,
        render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
          `${appConfig.name} — ${company?.name ?? ""} · Sayfa ${pageNumber} / ${totalPages}`,
      }),
    ),
  );

  const buffer = await renderToBuffer(doc as any);

  return new NextResponse(buffer as any, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${proposal.title.replace(/[^a-z0-9]+/gi, "-")}.pdf"`,
    },
  });
}
