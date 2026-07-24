import { NextResponse } from "next/server";
import { renderToBuffer, Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
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
    { src: path.join(process.cwd(), "fonts", "Inter-Regular.ttf"), fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: { padding: 0, fontSize: 10, fontFamily: "Inter", color: "#1a1c1a" },
  cover: { padding: 40, color: "#fff" },
  coverBrand: { fontSize: 11, fontWeight: 700, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  client: { fontSize: 11, color: "#eee", marginBottom: 16 },
  metaRow: { flexDirection: "row", gap: 24, marginTop: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.25)", paddingTop: 12 },
  metaLabel: { fontSize: 8, color: "rgba(255,255,255,0.7)", textTransform: "uppercase" },
  metaValue: { fontSize: 10, fontWeight: 700, marginTop: 2 },
  body: { padding: 40, paddingTop: 24 },
  h2: { fontSize: 11, fontWeight: 700, color: "#5b3df6", textTransform: "uppercase", marginTop: 18, marginBottom: 8 },
  text: { lineHeight: 1.5, fontSize: 10, color: "#333" },
  checkRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  checkMark: { fontSize: 9, color: "#5b3df6", fontWeight: 700 },
  checkTitle: { fontSize: 10, fontWeight: 700 },
  checkBody: { fontSize: 9.5, color: "#555", marginTop: 1, lineHeight: 1.4 },
  partiesRow: { flexDirection: "row", gap: 12 },
  partyBox: { flex: 1, borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 8, padding: 10 },
  partyLabel: { fontSize: 8, color: "#888", textTransform: "uppercase", marginBottom: 3 },
  partyName: { fontSize: 10, fontWeight: 700 },
  partyLine: { fontSize: 9, color: "#666", marginTop: 1 },
  pkgBox: { borderWidth: 1.5, borderColor: "#5b3df6", borderRadius: 8, padding: 12, backgroundColor: "#f8f7ff" },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "#eee" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 8, marginTop: 4, borderTopWidth: 2, borderTopColor: "#111" },
  totalLabel: { fontSize: 12, fontWeight: 700 },
  clause: { fontSize: 8.5, color: "#555", marginTop: 5, lineHeight: 1.4 },
  footer: { borderTopWidth: 1, borderTopColor: "#eee", padding: 16, textAlign: "center", fontSize: 8, color: "#888" },
});

function splitClauses(text: string): string[] {
  const parts = text.split(/\n?(?=\d+\.\s)/).map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [text];
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
    .select("*, clients(name), companies(name, primary_color, email)")
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .maybeSingle();

  if (!proposal) return NextResponse.json({ error: "Teklif bulunamadı." }, { status: 404 });

  const sections: { title: string; body: string }[] = proposal.sections || [];
  const lineItems: { name: string; qty: number; unit: number; optional?: boolean; included?: boolean }[] = proposal.line_items || [];
  const billingOptions: { key: string; label: { tr: string; en: string }; price: number }[] = proposal.billing_options || [];
  const nextSteps: { title: string; body: string }[] = proposal.next_steps || [];
  const client: Record<string, string> = proposal.client_contact || {};
  const company = proposal.companies;
  const brandColor = company?.primary_color || "#5b3df6";
  const total = lineItems.reduce((s, li) => (li.optional && !li.included ? s : s + li.qty * li.unit), 0);
  const validDays = proposal.valid_days || 15;
  const createdDate = new Date(proposal.created_at).toLocaleDateString("tr-TR");

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
        React.createElement(Text, { style: styles.coverBrand }, company?.name ?? appConfig.name),
        React.createElement(Text, { style: styles.title }, proposal.title),
        React.createElement(Text, { style: styles.client }, proposal.clients?.name ?? ""),
        React.createElement(
          View,
          { style: styles.metaRow },
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
              React.createElement(Text, { style: styles.h2 }, "Ön Yazı"),
              React.createElement(Text, { style: styles.text }, proposal.intro_text),
            )
          : null,

        // Hakkımızda
        proposal.about_text
          ? React.createElement(
              View,
              {},
              React.createElement(Text, { style: styles.h2 }, "Hakkımızda"),
              React.createElement(Text, { style: styles.text }, proposal.about_text),
            )
          : null,

        // Taraflar
        React.createElement(
          View,
          {},
          React.createElement(Text, { style: styles.h2 }, "Taraflar"),
          React.createElement(
            View,
            { style: styles.partiesRow },
            React.createElement(
              View,
              { style: styles.partyBox },
              React.createElement(Text, { style: styles.partyLabel }, "Hizmeti Sunan"),
              React.createElement(Text, { style: styles.partyName }, company?.name ?? ""),
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
              React.createElement(Text, { style: styles.h2 }, "Hizmet Kapsamı"),
              ...sections.map((s, i) =>
                React.createElement(
                  View,
                  { key: i, style: styles.checkRow },
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
              React.createElement(Text, { style: styles.h2 }, "Paket ve Ücret"),
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
                    { key: i, style: styles.row },
                    React.createElement(Text, {}, `${li.name} × ${li.qty}${li.optional ? " (opsiyonel)" : ""}`),
                    React.createElement(Text, {}, `$${(li.optional && !li.included ? 0 : li.unit * li.qty).toLocaleString()}`),
                  ),
                ),
                lineItems.length > 0
                  ? React.createElement(
                      View,
                      { style: styles.totalRow },
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
              React.createElement(Text, { style: styles.h2 }, "Sözleşme Koşulları"),
              ...splitClauses(proposal.contract_text).map((c: string, i: number) =>
                React.createElement(Text, { key: i, style: styles.clause }, c),
              ),
            )
          : null,

        // Sonraki adımlar
        nextSteps.length > 0
          ? React.createElement(
              View,
              {},
              React.createElement(Text, { style: styles.h2 }, "Sonraki Adımlar"),
              ...nextSteps.map((step, i) =>
                React.createElement(
                  View,
                  { key: i, style: styles.checkRow },
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

      React.createElement(
        Text,
        { style: styles.footer },
        `${appConfig.name} — ${company?.name ?? ""} · Bu teklif ${createdDate} tarihinden itibaren ${validDays} gün geçerlidir.`,
      ),
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
