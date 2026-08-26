"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2, FileText, TrendingUp, DollarSign, Target, Download } from "lucide-react";
import { WinGauge, AcceptanceChart } from "@/components/app/charts";
import { useLang } from "@/components/i18n/language-provider";
import { formatUsd } from "@/lib/utils";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlan } from "@/components/app/plan-provider";
import { planAllows } from "@/lib/plan";
import { demoReportRows } from "@/lib/demo/data";

type Proposal = { id: string; status: string; value: number; created_at: string };

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function downloadCsv(proposals: Proposal[]) {
  const header = ["id", "status", "value", "created_at"];
  const lines = proposals.map((p) => [p.id, p.status, String(p.value ?? 0), p.created_at].join(","));
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "teklif-raporu.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function AnalyticsPage() {
  const { lang } = useLang();
  const plan = usePlan();
  const pathname = usePathname();
  const isDemo = pathname?.startsWith("/demo") ?? false;
  const allowed = planAllows(plan, "analytics");
  const reportingAllowed = planAllows(plan, "advanced_reporting");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    // The public /demo shell has no session — /api/proposals would just
    // return an empty list, so show the curated demo report instead of an
    // empty "no proposals yet" state.
    if (isDemo) {
      setProposals(demoReportRows.map((r, i) => ({ id: `demo-${i}`, ...r })));
      setLoading(false);
      return;
    }
    fetch("/api/proposals")
      .then((res) => res.json())
      .then((data) => setProposals(data.proposals ?? []))
      .finally(() => setLoading(false));
  }, [allowed, isDemo]);

  const stats = useMemo(() => {
    const total = proposals.length;
    const byStatus = { draft: 0, sent: 0, viewed: 0, accepted: 0, declined: 0 } as Record<string, number>;
    let acceptedValue = 0;
    for (const p of proposals) {
      byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
      if (p.status === "accepted") acceptedValue += Number(p.value) || 0;
    }
    const decided = byStatus.accepted + byStatus.declined;
    const winRate = decided > 0 ? Math.round((byStatus.accepted / decided) * 100) : 0;
    const avgDeal = byStatus.accepted > 0 ? acceptedValue / byStatus.accepted : 0;
    return { total, byStatus, acceptedValue, winRate, avgDeal, decided };
  }, [proposals]);

  const monthlyTrend = useMemo(() => {
    const byMonth = new Map<string, { sent: number; accepted: number }>();
    for (const p of proposals) {
      const key = monthKey(p.created_at);
      const entry = byMonth.get(key) ?? { sent: 0, accepted: 0 };
      entry.sent += 1;
      if (p.status === "accepted") entry.accepted += 1;
      byMonth.set(key, entry);
    }
    return [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, v]) => ({ label: key.slice(2), sent: v.sent, accepted: v.accepted }));
  }, [proposals]);

  async function downloadPdf() {
    setPdfLoading(true);
    try {
      const res = await fetch(`/api/reports/proposals${isDemo ? "?demo=1" : ""}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "teklif-raporu.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setPdfLoading(false);
    }
  }

  const STATUS_LABEL: Record<string, { tr: string; en: string }> = {
    draft: { tr: "Taslak", en: "Draft" },
    sent: { tr: "Gönderildi", en: "Sent" },
    viewed: { tr: "Görüntülendi", en: "Viewed" },
    accepted: { tr: "Kabul", en: "Accepted" },
    declined: { tr: "Reddedildi", en: "Declined" },
  };

  if (!allowed) {
    return (
      <div className="mx-auto max-w-[1100px]">
        <Card>
          <CardHeader>
            <CardTitle>{lang === "tr" ? "Analitik" : "Analytics"}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {lang === "tr"
                ? "Analitik Pro ve Custom paketlerinde kullanılabilir. Ücretsiz deneme (Lite) bu özelliği içermez."
                : "Analytics is available on the Pro and Custom plans. The free trial (Lite) doesn't include this feature."}
            </p>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] animate-fade-in space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">{lang === "tr" ? "Analitik" : "Analytics"}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {lang === "tr" ? "Gerçek tekliflerinin performansı." : "Performance across your real proposals."}
        </p>
      </div>

      {stats.total === 0 ? (
        <div className="glass-card p-10 text-center text-sm text-muted-foreground">
          {lang === "tr"
            ? "Henüz teklif yok — ilk teklifini oluşturunca burada istatistiklerini göreceksin."
            : "No proposals yet — create your first one to see stats here."}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileText className="h-4 w-4" />
                <p className="text-[12.5px] font-medium">{lang === "tr" ? "Toplam teklif" : "Total proposals"}</p>
              </div>
              <p className="tnum mt-2 text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Target className="h-4 w-4" />
                <p className="text-[12.5px] font-medium">{lang === "tr" ? "Kazanma oranı" : "Win rate"}</p>
              </div>
              <p className="tnum mt-2 text-2xl font-bold">{stats.decided > 0 ? `${stats.winRate}%` : "—"}</p>
              {stats.decided === 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {lang === "tr" ? "Henüz sonuçlanan teklif yok" : "No decided proposals yet"}
                </p>
              )}
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <p className="text-[12.5px] font-medium">{lang === "tr" ? "Kabul edilen değer" : "Accepted value"}</p>
              </div>
              <p className="tnum mt-2 text-2xl font-bold">{formatUsd(stats.acceptedValue)}</p>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <p className="text-[12.5px] font-medium">{lang === "tr" ? "Ortalama anlaşma" : "Avg. deal size"}</p>
              </div>
              <p className="tnum mt-2 text-2xl font-bold">{stats.byStatus.accepted > 0 ? formatUsd(stats.avgDeal) : "—"}</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <div className="glass-card p-5">
              <h3 className="font-display text-[15px] font-semibold tracking-tight">{lang === "tr" ? "Kazanma oranı" : "Win rate"}</h3>
              <div className="mt-4 flex items-center gap-5">
                <WinGauge pct={stats.winRate} />
                <div className="space-y-2 text-[13px]">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-success" />
                    <span className="text-muted-foreground">{lang === "tr" ? "Kabul" : "Accepted"}</span>
                    <span className="tnum ml-auto font-semibold">{stats.byStatus.accepted}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-destructive" />
                    <span className="text-muted-foreground">{lang === "tr" ? "Reddedildi" : "Declined"}</span>
                    <span className="tnum ml-auto font-semibold">{stats.byStatus.declined}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card p-5">
              <h3 className="font-display text-[15px] font-semibold tracking-tight">{lang === "tr" ? "Durum dağılımı" : "Status breakdown"}</h3>
              <div className="mt-4 space-y-3">
                {Object.entries(stats.byStatus).map(([key, count]) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-[13px] text-muted-foreground">{STATUS_LABEL[key]?.[lang] ?? key}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: stats.total > 0 ? `${(count / stats.total) * 100}%` : "0%" }}
                      />
                    </div>
                    <span className="tnum w-6 shrink-0 text-right text-[13px] font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {reportingAllowed && monthlyTrend.length > 0 && (
            <div className="glass-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-[15px] font-semibold tracking-tight">
                    {lang === "tr" ? "Aylık trend" : "Monthly trend"}
                  </h3>
                  <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                    {lang === "tr" ? "Custom pakete özel raporlama." : "Custom-plan reporting."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => downloadCsv(proposals)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <Download className="h-3.5 w-3.5" />
                    CSV
                  </button>
                  <button
                    onClick={downloadPdf}
                    disabled={pdfLoading}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    {pdfLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    PDF
                  </button>
                </div>
              </div>
              <AcceptanceChart data={monthlyTrend} height={180} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
