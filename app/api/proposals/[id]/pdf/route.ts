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

const styles = StyleSheet.create({
  page: { padding: 0, fontSize: 10, fontFamily: "Inter", color: "#1a1c1a" },
  cover: { position: "relative", padding: 40, color: "#fff", minHeight: 260 },
  coverBg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  coverLogo: { height: 28, marginBottom: 10, objectFit: "contain" },
  coverBrand: { fontSize: 11, fontWeight: 700, marginBottom: 16, letterSpacing: 0.5 },
  title: { fontSize: 24, fontWeight: 700, marginBottom: 4 },
  client: { fontSize: 11, color: "#eee", marginBottom: 16 },
  metaCard: {
    flexDirection: "row",
    gap: 24,
    marginTop: 20,
    alignSelf: "flex-end",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  metaLabel: { fontSize: 8, color: "rgba(255,255,255,0.75)", textTransform: "uppercase", letterSpacing: 0.5 },
  metaValue: { fontSize: 10, fontWeight: 700, marginTop: 2 },
  body: { padding: 40, paddingTop: 24, paddingBottom: 48 },
  h2Row: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 18, marginBottom: 8 },
  h2Bar: { width: 3, height: 11, backgroundColor: "#5b3df6", borderRadius: 2 },
  h2: { fontSize: 11, fontWeight: 700, color: "#5b3df6", textTransform: "uppercase", letterSpacing: 0.5 },
  text: { lineHeight: 1.5, fontSize: 10, color: "#333" },
  checkRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  checkMark: { fontSize: 9, color: "#5b3df6", fontWeight: 700 },
  checkTitle: { fontSize: 10, fontWeight: 700 },
  checkBody: { fontSize: 9.5, color: "#555", marginTop: 1, lineHeight: 1.4 },
  partiesRow: { flexDirection: "row", gap: 12 },
  partyBox: { flex: 1, borderWidth: 1, borderColor: "#ECEBF1", borderRadius: 10, padding: 12, backgroundColor: "#FAFAFC" },
  partyLabel: { fontSize: 8, color: "#888", textTransform: "uppercase", marginBottom: 3, letterSpacing: 0.5 },
  partyName: { fontSize: 10, fontWeight: 700 },
  partyLine: { fontSize: 9, color: "#666", marginTop: 1 },
  pkgBox: { borderWidth: 1, borderLeftWidth: 3, borderColor: "#ECEBF1", borderLeftColor: "#5b3df6", borderRadius: 10, padding: 14, backgroundColor: "#f8f7ff" },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: "#eee" },
  rowAlt: { backgroundColor: "rgba(91,61,246,0.04)" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#1e293b",
  },
  totalLabel: { fontSize: 12, fontWeight: 700, color: "#fff" },
  clauseBox: { flexDirection: "row", gap: 8, marginTop: 6 },
  clauseBar: { width: 2, backgroundColor: "#ECEBF1", borderRadius: 1 },
  clause: { fontSize: 8.5, color: "#555", lineHeight: 1.4, flex: 1 },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingVertical: 10,
    paddingHorizontal: 16,
    textAlign: "center",
    fontSize: 8,
    color: "#888",
  },
  auditTable: { borderWidth: 1, borderColor: "#ECEBF1", borderRadius: 8, marginTop: 4, overflow: "hidden" },
  auditHeaderRow: { flexDirection: "row", backgroundColor: "#f8f7ff", borderBottomWidth: 1, borderBottomColor: "#ECEBF1" },
  auditRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#eee" },
  auditRowAlt: { backgroundColor: "#FAFAFC" },
  auditCellRole: { width: "16%", padding: 6, fontSize: 8.5 },
  auditCellSigner: { width: "26%", padding: 6, fontSize: 8.5 },
  auditCellIp: { width: "18%", padding: 6, fontSize: 8.5 },
  auditCellTime: { width: "24%", padding: 6, fontSize: 8.5 },
  auditCellOtp: { width: "16%", padding: 6, fontSize: 8.5 },
  auditHeaderCell: { fontSize: 8, fontWeight: 700, color: "#5b3df6", textTransform: "uppercase" },
  auditEmpty: { fontSize: 9, color: "#888", marginTop: 8 },
  auditNoteBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  auditNoteMark: { fontSize: 11, color: "#16a34a", fontWeight: 700 },
  auditNote: { fontSize: 8.5, color: "#166534", lineHeight: 1.4, flex: 1 },
});

function splitClauses(text: string): string[] {
  const parts = text.split(/\n?(?=\d+\.\s)/).map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [text];
}

function h2El(label: string) {
  return React.createElement(
    View,
    { style: styles.h2Row },
    React.createElement(View, { style: styles.h2Bar }),
    React.createElement(Text, { style: styles.h2 }, label),
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
  const brandColor = company?.primary_color || "#5b3df6";
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
        { style: [styles.cover, { backgroundColor: brandColor }] },
        React.createElement(
          Svg,
          { style: styles.coverBg, viewBox: "0 0 600 320" },
          React.createElement(
            Defs,
            {},
            React.createElement(
              LinearGradient,
              { id: "coverGrad", x1: "0", y1: "0", x2: "1", y2: "1" },
              React.createElement(Stop, { offset: "0", stopColor: brandColor, stopOpacity: 1 }),
              React.createElement(Stop, { offset: "1", stopColor: "#a955f7", stopOpacity: 1 }),
            ),
          ),
          React.createElement(Rect, { x: "0", y: "0", width: "600", height: "320", fill: "url(#coverGrad)" }),
        ),
        company?.logo_url ? React.createElement(Image, { style: styles.coverLogo, src: company.logo_url }) : null,
        React.createElement(Text, { style: styles.coverBrand }, company?.name ?? appConfig.name),
        React.createElement(Text, { style: styles.title }, proposal.title),
        React.createElement(Text, { style: styles.client }, proposal.clients?.name ?? ""),
        React.createElement(
          View,
          { style: styles.metaCard },
          React.createElement(
            View,
            {},
            React.createElement(Text, { style: styles.metaLabel }, "Hazırlayan"),
            React.createElement(Text, { style: styles.metaValue }, company?.name ?? ""),
          ),
          React.createElement(
            View,
            {},
            React.createElement(Text, { style: styles.metaLabel }, "Muhatap"),
            React.createElement(Text, { style: styles.metaValue }, client.contactName || proposal.clients?.name || "—"),
          ),
          React.createElement(
            View,
            {},
            React.createElement(Text, { style: styles.metaLabel }, "Teklif Tarihi"),
            React.createElement(Text, { style: styles.metaValue }, createdDate),
          ),
          React.createElement(
            View,
            {},
            React.createElement(Text, { style: styles.metaLabel }, "Geçerlilik"),
            React.createElement(Text, { style: styles.metaValue }, `${validDays} gün`),
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
              {},
              h2El("Ön Yazı"),
              React.createElement(Text, { style: styles.text }, proposal.intro_text),
            )
          : null,

        // Hakkımızda
        proposal.about_text
          ? React.createElement(
              View,
              {},
              h2El("Hakkımızda"),
              React.createElement(Text, { style: styles.text }, proposal.about_text),
            )
          : null,

        // Taraflar
        React.createElement(
          View,
          {},
          h2El("Taraflar"),
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

        // Hizmet kapsamı
        sections.length > 0
          ? React.createElement(
              View,
              {},
              h2El("Hizmet Kapsamı"),
              ...sections.map((s, i) =>
                React.createElement(
                  View,
                  { key: i, style: styles.checkRow, wrap: false },
                  React.createElement(Text, { style: styles.checkMark }, "✓"),
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
              {},
              h2El("Paket ve Ücret"),
              React.createElement(
                View,
                { style: styles.pkgBox },
                ...billingOptions.map((o, i) =>
                  React.createElement(
                    Text,
                    { key: `b${i}`, style: { fontSize: 10, fontWeight: 700, marginBottom: 4 } },
                    `${o.label.tr}: $${o.price.toLocaleString()}`,
                  ),
                ),
                ...lineItems.map((li, i) =>
                  React.createElement(
                    View,
                    { key: i, style: i % 2 === 1 ? [styles.row, styles.rowAlt] : styles.row, wrap: false },
                    React.createElement(Text, {}, `${li.name} × ${li.qty}${li.optional ? " (opsiyonel)" : ""}`),
                    React.createElement(Text, {}, `$${(li.optional && !li.included ? 0 : li.unit * li.qty).toLocaleString()}`),
                  ),
                ),
                lineItems.length > 0
                  ? React.createElement(
                      View,
                      { style: styles.totalRow, wrap: false },
                      React.createElement(Text, { style: styles.totalLabel }, "Toplam"),
                      React.createElement(Text, { style: styles.totalLabel }, `$${total.toLocaleString()}`),
                    )
                  : null,
              ),
            )
          : null,

        // Sözleşme koşulları
        proposal.contract_text
          ? React.createElement(
              View,
              {},
              h2El("Sözleşme Koşulları"),
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
              {},
              h2El("Sonraki Adımlar"),
              ...nextSteps.map((step, i) =>
                React.createElement(
                  View,
                  { key: i, style: styles.checkRow, wrap: false },
                  React.createElement(Text, { style: styles.checkMark }, "✓"),
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
        h2El("İmza ve Denetim İzi (Audit Trail)"),
        auditRows.length === 0
          ? React.createElement(Text, { style: styles.auditEmpty }, "Bu teklif için henüz kayıtlı bir imza yok.")
          : React.createElement(
              View,
              { style: styles.auditTable },
              React.createElement(
                View,
                { style: styles.auditHeaderRow },
                React.createElement(Text, { style: [styles.auditCellRole, styles.auditHeaderCell] }, "Rol"),
                React.createElement(Text, { style: [styles.auditCellSigner, styles.auditHeaderCell] }, "İsim / E-posta"),
                React.createElement(Text, { style: [styles.auditCellIp, styles.auditHeaderCell] }, "IP Adresi"),
                React.createElement(Text, { style: [styles.auditCellTime, styles.auditHeaderCell] }, "Zaman Damgası"),
                React.createElement(Text, { style: [styles.auditCellOtp, styles.auditHeaderCell] }, "OTP Doğrulama"),
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
