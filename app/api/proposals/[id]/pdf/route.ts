import { NextResponse } from "next/server";
import { renderToBuffer, Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";
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
  page: { padding: 48, fontSize: 11, fontFamily: "Inter", color: "#1a1c1a" },
  title: { fontSize: 24, fontWeight: 700, marginBottom: 4 },
  client: { fontSize: 12, color: "#666", marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: 700, marginTop: 18, marginBottom: 6 },
  body: { lineHeight: 1.5 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#eee" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 10, marginTop: 6, borderTopWidth: 2, borderTopColor: "#111" },
  totalLabel: { fontSize: 13, fontWeight: 700 },
  contract: { fontSize: 9, color: "#555", marginTop: 6, lineHeight: 1.4 },
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket bulunamadı." }, { status: 404 });

  const { data: proposal } = await service
    .from("proposals")
    .select("*, clients(name)")
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .maybeSingle();

  if (!proposal) return NextResponse.json({ error: "Teklif bulunamadı." }, { status: 404 });

  const sections: { title: string; body: string }[] = proposal.sections || [];
  const lineItems: { name: string; qty: number; unit: number }[] = proposal.line_items || [];
  const total = lineItems.reduce((s, li) => s + li.qty * li.unit, 0);

  const doc = React.createElement(
    Document,
    {},
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(Text, { style: styles.title }, proposal.title),
      React.createElement(Text, { style: styles.client }, proposal.clients?.name ?? ""),
      ...sections.map((s, i) =>
        React.createElement(
          View,
          { key: i },
          React.createElement(Text, { style: styles.sectionTitle }, s.title),
          React.createElement(Text, { style: styles.body }, s.body),
        ),
      ),
      lineItems.length > 0
        ? React.createElement(
            View,
            { style: { marginTop: 18 } },
            React.createElement(Text, { style: styles.sectionTitle }, "Yatırım"),
            ...lineItems.map((li, i) =>
              React.createElement(
                View,
                { key: i, style: styles.row },
                React.createElement(Text, {}, `${li.name} × ${li.qty}`),
                React.createElement(Text, {}, `$${(li.unit * li.qty).toLocaleString()}`),
              ),
            ),
            React.createElement(
              View,
              { style: styles.totalRow },
              React.createElement(Text, { style: styles.totalLabel }, "Toplam"),
              React.createElement(Text, { style: styles.totalLabel }, `$${total.toLocaleString()}`),
            ),
          )
        : null,
      proposal.contract_text
        ? React.createElement(
            View,
            { style: { marginTop: 18 } },
            React.createElement(Text, { style: styles.sectionTitle }, "Sözleşme Şartları"),
            React.createElement(Text, { style: styles.contract }, proposal.contract_text),
          )
        : null,
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
