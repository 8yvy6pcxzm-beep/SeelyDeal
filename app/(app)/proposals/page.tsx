"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Sparkles, PenLine, Eye, ArrowUpDown, Download, Link2, Settings2, Clock } from "lucide-react";
import { Sparkline } from "@/components/app/charts";
import { StatusPill, ClientAvatar, Checkbox } from "@/components/app/proposal-bits";
import { AiDraftDialog } from "@/components/app/ai-draft-dialog";
import { EditProposalDialog } from "@/components/app/edit-proposal-dialog";
import { SectionTimesDialog } from "@/components/app/section-times-dialog";
import { useLang } from "@/components/i18n/language-provider";
import { cn, formatUsd } from "@/lib/utils";
import { proposals, pipeline, type ProposalStatus } from "@/lib/demo/data";

const FILTERS: { key: ProposalStatus | "all"; label: { tr: string; en: string } }[] = [
  { key: "all", label: { tr: "Tümü", en: "All" } },
  { key: "draft", label: { tr: "Taslak", en: "Draft" } },
  { key: "sent", label: { tr: "Gönderildi", en: "Sent" } },
  { key: "viewed", label: { tr: "Görüntülendi", en: "Viewed" } },
  { key: "accepted", label: { tr: "Kabul", en: "Accepted" } },
  { key: "declined", label: { tr: "Reddedildi", en: "Declined" } },
];

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getUTCDate()} ${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })}`;
}

export default function ProposalsPage() {
  const { t, lang } = useLang();
  const [filter, setFilter] = useState<ProposalStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sectionTimesId, setSectionTimesId] = useState<string | null>(null);
  const [realRows, setRealRows] = useState<typeof proposals>([]);
  const [liveIds, setLiveIds] = useState<Set<string>>(new Set());
  const [liveSelections, setLiveSelections] = useState<Map<string, { lineItems: { name: string; included?: boolean }[]; billingKey: string | null }>>(new Map());

  async function loadReal() {
    try {
      const res = await fetch("/api/proposals");
      const data = await res.json();
      const mapped = (data.proposals ?? []).map((p: any, i: number) => ({
        id: p.id,
        number: `AI-${String(i + 1).padStart(4, "0")}`,
        title: { tr: p.title, en: p.title },
        client: p.clients?.name ?? "—",
        clientEmail: "",
        clientInitials: (p.clients?.name ?? "?").slice(0, 2).toUpperCase(),
        value: Number(p.value) || 0,
        status: p.status,
        sentDate: null,
        views: p.view_count ?? 0,
        spark: p.view_spark ?? [0, 0, 0, 0, 0, 0, 0],
        signed: p.status === "accepted",
        viewSummary: { tr: "", en: "" },
        sections: p.sections ?? [],
        timeline: [],
        lineItems: p.line_items ?? [],
        template: { tr: "AI taslağı", en: "AI draft" },
      }));
      setRealRows(mapped);
      setLiveIds(new Set((data.proposals ?? []).filter((p: any) => p.live_now).map((p: any) => p.id)));
      setLiveSelections(
        new Map(
          (data.proposals ?? [])
            .filter((p: any) => p.live_selection)
            .map((p: any) => [p.id, p.live_selection]),
        ),
      );
    } catch {
      setRealRows([]);
    }
  }

  useEffect(() => {
    loadReal();
    // Poll so the "şu an bakıyor" badge stays roughly live without a websocket.
    const interval = setInterval(loadReal, 20000);
    return () => clearInterval(interval);
  }, []);

  const allProposals = useMemo(() => [...realRows, ...proposals], [realRows]);
  const realIds = useMemo(() => new Set(realRows.map((r) => r.id)), [realRows]);

  const rows = useMemo(
    () =>
      allProposals.filter((p) => {
        const okStatus = filter === "all" || p.status === filter;
        const okQuery =
          !query ||
          p.client.toLowerCase().includes(query.toLowerCase()) ||
          t(p.title).toLowerCase().includes(query.toLowerCase()) ||
          p.number.toLowerCase().includes(query.toLowerCase());
        return okStatus && okQuery;
      }),
    [allProposals, filter, query, t],
  );

  const totalValue = rows.reduce((s, p) => s + p.value, 0);

  return (
    <div className="mx-auto max-w-[1200px] animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {lang === "tr" ? "Teklifler" : "Proposals"}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {lang === "tr"
              ? "Tüm tekliflerin, durumları ve görüntülenmeleri."
              : "All your proposals, their status and views."}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setAiOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3.5 text-[13px] font-medium text-foreground shadow-pill transition-colors hover:bg-muted"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            {lang === "tr" ? "AI ile yaz" : "Draft with AI"}
          </button>
          <button
            onClick={() => setAiOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            {lang === "tr" ? "Yeni teklif" : "New proposal"}
          </button>
        </div>
      </div>

      {/* Pipeline summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {pipeline.map((col) => (
          <div key={col.status} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <StatusPill status={col.status} lang={lang} />
              <span className="tnum text-lg font-bold">{col.count}</span>
            </div>
            <p className="tnum mt-2.5 text-[13px] font-semibold text-muted-foreground">{formatUsd(col.value)}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-border p-4">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
                  filter === f.key ? "bg-card text-foreground shadow-pill" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label[lang]}
              </button>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={lang === "tr" ? "Müşteri veya başlık…" : "Client or title…"}
                className="w-32 bg-transparent text-foreground placeholder:text-muted-foreground/70 focus:outline-none sm:w-44"
              />
            </div>
            <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-muted">
              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              {lang === "tr" ? "Sırala" : "Sort"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="w-10 py-2.5 pl-4"><Checkbox /></th>
                <th className="label-mono py-2.5 font-medium text-muted-foreground">{lang === "tr" ? "Teklif" : "Proposal"}</th>
                <th className="label-mono py-2.5 font-medium text-muted-foreground">{lang === "tr" ? "Şablon" : "Template"}</th>
                <th className="label-mono py-2.5 font-medium text-muted-foreground">{lang === "tr" ? "Durum" : "Status"}</th>
                <th className="label-mono py-2.5 font-medium text-muted-foreground">{lang === "tr" ? "Gönderim" : "Sent"}</th>
                <th className="label-mono py-2.5 text-center font-medium text-muted-foreground">{lang === "tr" ? "Görüntüleme" : "Views"}</th>
                <th className="label-mono py-2.5 pr-4 text-right font-medium text-muted-foreground">{lang === "tr" ? "Değer" : "Value"}</th>
                <th className="label-mono w-10 py-2.5 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50">
                  <td className="py-3 pl-4"><Checkbox /></td>
                  <td className="py-3">
                    <div className="flex items-center gap-2.5">
                      <ClientAvatar initials={row.clientInitials} size={32} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold leading-tight">{t(row.title)}</p>
                        <p className="text-xs text-muted-foreground"><span className="tnum">{row.number}</span> · {row.client}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-[13px] text-muted-foreground">{t(row.template)}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="inline-flex items-center gap-1.5">
                      <StatusPill status={row.status} lang={lang} />
                      {row.signed && <PenLine className="h-3 w-3 text-success" />}
                      {liveIds.has(row.id) && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-success/10 px-1.5 py-0.5 text-[11px] font-medium text-success"
                          title={
                            liveSelections.get(row.id)
                              ? liveSelections
                                  .get(row.id)!
                                  .lineItems.filter((li) => li.included !== false)
                                  .map((li) => li.name)
                                  .join(", ")
                              : undefined
                          }
                        >
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                          {lang === "tr" ? "Şu an bakıyor" : "Viewing now"}
                          {liveSelections.get(row.id) &&
                            ` · ${liveSelections.get(row.id)!.lineItems.filter((li) => li.included !== false).length}/${liveSelections.get(row.id)!.lineItems.length} ${lang === "tr" ? "kalem" : "items"}`}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="tnum whitespace-nowrap text-[13px] text-muted-foreground">{fmtDate(row.sentDate)}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center justify-center gap-2">
                      <span className="tnum w-5 text-right text-[13px] font-semibold">{row.views}</span>
                      <Sparkline data={row.spark} width={64} height={22} />
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <p className="tnum font-semibold">{formatUsd(row.value)}</p>
                  </td>
                  <td className="py-3 pr-4 text-right">
                    {realIds.has(row.id) && (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(row.id);
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          title={lang === "tr" ? "Düzenle" : "Edit"}
                        >
                          <Settings2 className="h-3.5 w-3.5" />
                        </button>
                        <a
                          href={`/p/${row.id}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (row.status === "draft") {
                              fetch(`/api/proposals/${row.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ status: "sent" }),
                              }).then(loadReal);
                            }
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          title={lang === "tr" ? "Müşteri linkini aç" : "Open client link"}
                        >
                          <Link2 className="h-3.5 w-3.5" />
                        </a>
                        <a
                          href={`/api/proposals/${row.id}/pdf`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          title={lang === "tr" ? "PDF olarak indir" : "Download as PDF"}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSectionTimesId(row.id);
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          title={lang === "tr" ? "Bölüm bazlı görüntüleme süresi" : "Time spent per section"}
                        >
                          <Clock className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    {lang === "tr" ? "Bu filtreyle teklif yok." : "No proposals match this filter."}
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-border">
                  <td colSpan={6} className="py-3 pl-4 text-[13px] font-medium text-muted-foreground">
                    {rows.length} {lang === "tr" ? "teklif" : "proposals"}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <span className="tnum text-[13px] font-bold">{formatUsd(totalValue)}</span>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <Eye className="h-3.5 w-3.5" />
        {lang === "tr" ? "Bir satıra tıkla — panelden detay sürgüsünü aç." : "Row detail drawer lives on the Dashboard cockpit."}
      </p>

      <AiDraftDialog open={aiOpen} onClose={() => setAiOpen(false)} onSaved={loadReal} />
      <EditProposalDialog proposalId={editingId} onClose={() => setEditingId(null)} onSaved={loadReal} />
      <SectionTimesDialog proposalId={sectionTimesId} onClose={() => setSectionTimesId(null)} />
    </div>
  );
}
