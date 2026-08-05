import { NextResponse } from "next/server";
import { renderToBuffer, Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";
import { planAllows, type Plan } from "@/lib/plan";
import { demoReportRows } from "@/lib/demo/data";
import appConfig from "@/app.config";
import React from "react";
import path from "node:path";

Font.register({
  family: "Inter",
  fonts: [
    { src: path.join(process.cwd(), "fonts", "Inter-Regular.ttf"), fontWeight: 400 },
    { src: path.join(process.cwd(), "fonts", "Inter-Regular.ttf"), fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Inter", color: "#1a1c1a" },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 10, color: "#666", marginBottom: 18 },
  h2: { fontSize: 11, fontWeight: 700, color: "#5b3df6", textTransform: "uppercase", marginTop: 14, marginBottom: 6 },
  statsRow: { flexDirection: "row", gap: 16, marginBottom: 8 },
  statBox: { flex: 1, borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 6, padding: 8 },
  statLabel: { fontSize: 8, color: "#888", textTransform: "uppercase" },
  statValue: { fontSize: 14, fontWeight: 700, marginTop: 2 },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1.5, borderBottomColor: "#111", paddingBottom: 4, marginTop: 4 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#eee", paddingVertical: 4 },
  colMonth: { width: "25%", fontSize: 9 },
  colNum: { width: "25%", fontSize: 9, textAlign: "right" },
  headCell: { fontSize: 8.5, fontWeight: 700, color: "#555" },
  footer: { marginTop: 20, fontSize: 8, color: "#888", textAlign: "center" },
});

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET(req: Request) {
  // The public /demo shell has no session — it explicitly asks for the mock
  // report via ?demo=1 rather than us inferring "no auth" means "show demo",
  // so a real logged-out call still gets a normal 401.
  const isDemo = new URL(req.url).searchParams.get("demo") === "1";
  let rows: { status: string; value: number; created_at: string }[];
  let companyName = appConfig.name;

  if (isDemo) {
    rows = demoReportRows;
  } else {
    const user = await getAuthedUser(req);
    if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

    const service = createServiceClient();
    const { data: profile } = await service.from("profiles").select("company_id, companies(plan, name)").eq("id", user.id).maybeSingle();
    if (!profile) return NextResponse.json({ error: "Şirket bulunamadı." }, { status: 404 });

    const company = profile.companies as unknown as { plan: Plan; name: string } | null;
    if (!planAllows(company?.plan, "advanced_reporting")) {
      return NextResponse.json({ error: "Bu rapor Custom pakette kullanılabilir." }, { status: 403 });
    }
    companyName = company?.name ?? appConfig.name;

    const { data: proposals } = await service
      .from("proposals")
      .select("status, value, created_at")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: true });

    rows = proposals ?? [];
  }
  const byMonth = new Map<string, { sent: number; accepted: number; value: number }>();
  for (const p of rows) {
    const key = monthKey(p.created_at);
    const entry = byMonth.get(key) ?? { sent: 0, accepted: 0, value: 0 };
    entry.sent += 1;
    if (p.status === "accepted") {
      entry.accepted += 1;
      entry.value += Number(p.value) || 0;
    }
    byMonth.set(key, entry);
  }
  const months = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b));

  const total = rows.length;
  const accepted = rows.filter((p) => p.status === "accepted").length;
  const acceptedValue = rows.reduce((s, p) => (p.status === "accepted" ? s + (Number(p.value) || 0) : s), 0);
  const winRate = accepted > 0 || rows.some((p) => p.status === "declined") ? Math.round((accepted / (accepted + rows.filter((p) => p.status === "declined").length || 1)) * 100) : 0;

  const doc = React.createElement(
    Document,
    {},
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(Text, { style: styles.title }, "Teklif Raporu"),
      React.createElement(Text, { style: styles.subtitle }, `${companyName} · ${new Date().toLocaleDateString("tr-TR")}`),

      React.createElement(
        View,
        { style: styles.statsRow },
        React.createElement(
          View,
          { style: styles.statBox },
          React.createElement(Text, { style: styles.statLabel }, "Toplam Teklif"),
          React.createElement(Text, { style: styles.statValue }, String(total)),
        ),
        React.createElement(
          View,
          { style: styles.statBox },
          React.createElement(Text, { style: styles.statLabel }, "Kazanma Oranı"),
          React.createElement(Text, { style: styles.statValue }, `${winRate}%`),
        ),
        React.createElement(
          View,
          { style: styles.statBox },
          React.createElement(Text, { style: styles.statLabel }, "Kabul Edilen Değer"),
          React.createElement(Text, { style: styles.statValue }, `$${acceptedValue.toLocaleString()}`),
        ),
      ),

      React.createElement(Text, { style: styles.h2 }, "Aylık Kırılım"),
      React.createElement(
        View,
        { style: styles.tableHeader },
        React.createElement(Text, { style: [styles.colMonth, styles.headCell] }, "Ay"),
        React.createElement(Text, { style: [styles.colNum, styles.headCell] }, "Gönderilen"),
        React.createElement(Text, { style: [styles.colNum, styles.headCell] }, "Kabul"),
        React.createElement(Text, { style: [styles.colNum, styles.headCell] }, "Değer"),
      ),
      ...months.map(([key, m]) =>
        React.createElement(
          View,
          { key, style: styles.tableRow },
          React.createElement(Text, { style: styles.colMonth }, key),
          React.createElement(Text, { style: styles.colNum }, String(m.sent)),
          React.createElement(Text, { style: styles.colNum }, String(m.accepted)),
          React.createElement(Text, { style: styles.colNum }, `$${m.value.toLocaleString()}`),
        ),
      ),

      React.createElement(Text, { style: styles.footer }, `${appConfig.name} — Custom paket raporlama.`),
    ),
  );

  const buffer = await renderToBuffer(doc as any);

  return new NextResponse(buffer as any, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="teklif-raporu.pdf"`,
    },
  });
}
