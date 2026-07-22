"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  ArrowUpDown,
  X,
  Eye,
  Send,
  PenLine,
  FileText,
  Sparkles,
  Bell,
  Check,
  Minus,
  Clock,
} from "lucide-react";
import { Sparkline, AcceptanceChart, WinGauge } from "@/components/app/charts";
import { StatusPill, ClientAvatar, Checkbox, STATUS_META } from "@/components/app/proposal-bits";
import { useLang } from "@/components/i18n/language-provider";
import { cn, formatUsd, formatRelative } from "@/lib/utils";
import {
  stats,
  pipeline,
  proposals,
  acceptance,
  acceptanceMeta,
  templates,
  activity,
  builderPreview,
  type ProposalStatus,
  type ProposalRow,
} from "@/lib/demo/data";

const STATUS_ICON: Record<ProposalStatus, typeof Send> = {
  draft: FileText,
  sent: Send,
  viewed: Eye,
  accepted: Check,
  declined: Minus,
};

function fmtDate(iso: string | null, lang: "tr" | "en") {
  if (!iso) return lang === "tr" ? "—" : "—";
  const d = new Date(iso);
  const day = d.getUTCDate();
  const mon = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${day} ${mon}`;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  const day = d.getUTCDate();
  const mon = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${mon} · ${hh}:${mm}`;
}

const FILTERS: { key: ProposalStatus | "all"; label: { tr: string; en: string } }[] = [
  { key: "all", label: { tr: "Tümü", en: "All" } },
  { key: "draft", label: { tr: "Taslak", en: "Draft" } },
  { key: "sent", label: { tr: "Gönderildi", en: "Sent" } },
  { key: "viewed", label: { tr: "Görüntülendi", en: "Viewed" } },
  { key: "accepted", label: { tr: "Kabul", en: "Accepted" } },
];

export default function DashboardPage() {
  const { t, lang } = useLang();
  const [filter, setFilter] = useState<ProposalStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>("p1");
  const [drawerOpen, setDrawerOpen] = useState(true);
  // The pricing table in the builder preview is live: toggling optional line
  // items + changing quantities recomputes the total.
  const [items, setItems] = useState(() => proposals[0].lineItems.map((l) => ({ ...l })));

  const rows = useMemo(
    () =>
      proposals.filter((p) => {
        const okStatus = filter === "all" || p.status === filter;
        const okQuery =
          !query ||
          p.client.toLowerCase().includes(query.toLowerCase()) ||
          t(p.title).toLowerCase().includes(query.toLowerCase()) ||
          p.number.toLowerCase().includes(query.toLowerCase());
        return okStatus && okQuery;
      }),
    [filter, query, t],
  );

  const current = proposals.find((p) => p.id === selected) ?? proposals[0];
  const maxPipeline = Math.max(...pipeline.map((c) => c.value));
  const builderTotal = items.reduce((sum, l) => (l.optional && !l.included ? sum : sum + l.unit * l.qty), 0);

  const viewedUnsigned = proposals.filter((p) => p.status === "viewed" && !p.signed);

  return (
    <div className="mx-auto max-w-[1500px] animate-fade-in">
      <div className={cn("grid gap-6", drawerOpen ? "xl:grid-cols-[1fr_380px]" : "grid-cols-1")}>
        {/* ── Main column ──────────────────────────────────────────── */}
        <div className="min-w-0 space-y-6">
          {/* Page header */}
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">
                {lang === "tr" ? "Teklif kokpiti" : "Proposals cockpit"}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {lang === "tr"
                  ? "Açık teklifler, görüntülenmeler ve imzalar — tek bakışta."
                  : "Open proposals, views and signatures — at a glance."}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3.5 text-[13px] font-medium text-foreground shadow-pill transition-colors hover:bg-muted">
                <Sparkles className="h-4 w-4 text-primary" />
                {lang === "tr" ? "AI ile yaz" : "Draft with AI"}
              </button>
              <button className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90">
                <Plus className="h-4 w-4" />
                {lang === "tr" ? "Yeni teklif" : "New proposal"}
              </button>
            </div>
          </div>

          {/* Stat row */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {stats.map((s) => {
              const up = (s.delta ?? 0) >= 0;
              const isWin = s.key === "winrate";
              return (
                <div key={s.key} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                  <p className="text-[12.5px] font-medium text-muted-foreground">{t(s.label)}</p>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <p className={cn("text-xl font-bold leading-none", isWin ? "tnum" : "tnum")}>{s.value}</p>
                    {s.delta !== undefined && (
                      <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-semibold", up ? "text-success" : "text-destructive")}>
                        {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {Math.abs(s.delta).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  {s.hint && <p className="mt-1.5 line-clamp-1 text-[11px] text-muted-foreground">{t(s.hint)}</p>}
                </div>
              );
            })}
          </div>

          {/* Pipeline status strip */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[15px] font-semibold tracking-tight">
                {lang === "tr" ? "Boru hattı" : "Pipeline"}
              </h2>
              <span className="text-xs text-muted-foreground">
                {lang === "tr" ? "Taslak → Gönderildi → Görüntülendi → Kabul" : "Draft → Sent → Viewed → Accepted"}
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {pipeline.map((col, i) => {
                const I = STATUS_ICON[col.status];
                const m = STATUS_META[col.status];
                return (
                  <div key={col.status} className="relative rounded-xl border border-border bg-muted/30 p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold">
                        <span className="grid h-6 w-6 place-items-center rounded-md text-white" style={{ background: m.dot }}>
                          <I className="h-3.5 w-3.5" />
                        </span>
                        {t(col.label)}
                      </span>
                      <span className="tnum text-sm font-bold">{col.count}</span>
                    </div>
                    <p className="tnum mt-2.5 text-[13px] font-semibold text-muted-foreground">{formatUsd(col.value)}</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                      <div className="h-full rounded-full" style={{ width: `${(col.value / maxPipeline) * 100}%`, background: m.dot }} />
                    </div>
                    {i < pipeline.length - 1 && (
                      <span className="absolute -right-[11px] top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 place-items-center rounded-full border border-border bg-card text-muted-foreground lg:grid">
                        <ArrowUpRight className="h-3 w-3 rotate-45" />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Viewed-but-not-signed alert panel */}
          {viewedUnsigned.length > 0 && (
            <div className="rounded-2xl border border-accent/30 bg-accent/[0.05] p-4 shadow-soft">
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
                  <Eye className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold">
                    {lang === "tr"
                      ? `${viewedUnsigned.length} teklif görüntülendi ama henüz imzalanmadı`
                      : `${viewedUnsigned.length} proposals viewed but not signed`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {lang === "tr" ? "Tam doğru anda bir hatırlatma gönder." : "Send a reminder at the perfect moment."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {viewedUnsigned.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelected(p.id);
                        setDrawerOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11.5px] font-medium transition-colors hover:bg-muted"
                    >
                      <span className="tnum">{p.number}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="truncate">{p.client}</span>
                    </button>
                  ))}
                  <button className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90">
                    <Bell className="h-3.5 w-3.5" />
                    {lang === "tr" ? "Hepsini hatırlat" : "Remind all"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Proposals table */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            <div className="flex flex-wrap items-center gap-2.5 border-b border-border p-4">
              <h2 className="font-display text-[15px] font-semibold tracking-tight">
                {lang === "tr" ? "Teklifler" : "Proposals"}
              </h2>
              {/* status filter (useState) */}
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
                    <th className="label-mono py-2.5 font-medium text-muted-foreground">{lang === "tr" ? "Durum" : "Status"}</th>
                    <th className="label-mono py-2.5 font-medium text-muted-foreground">{lang === "tr" ? "Gönderim" : "Sent"}</th>
                    <th className="label-mono py-2.5 text-center font-medium text-muted-foreground">{lang === "tr" ? "Görüntüleme" : "Views"}</th>
                    <th className="label-mono py-2.5 pr-4 text-right font-medium text-muted-foreground">{lang === "tr" ? "Değer" : "Value"}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isSel = row.id === selected;
                    return (
                      <tr
                        key={row.id}
                        onClick={() => {
                          setSelected(row.id);
                          setDrawerOpen(true);
                        }}
                        className={cn(
                          "cursor-pointer border-b border-border/60 transition-colors last:border-0",
                          isSel ? "bg-primary/[0.04]" : "hover:bg-muted/50",
                        )}
                      >
                        <td className="py-3 pl-4"><Checkbox checked={isSel} /></td>
                        <td className="py-3">
                          <div className="flex items-center gap-2.5">
                            <ClientAvatar initials={row.clientInitials} size={32} />
                            <div className="min-w-0">
                              <p className="truncate font-semibold leading-tight">{t(row.title)}</p>
                              <p className="text-xs text-muted-foreground">
                                <span className="tnum">{row.number}</span> · {row.client}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <StatusPill status={row.status} lang={lang} />
                          {row.signed && (
                            <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-success">
                              <PenLine className="h-3 w-3" />
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="tnum whitespace-nowrap text-[13px] text-muted-foreground">{fmtDate(row.sentDate, lang)}</span>
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
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        {lang === "tr" ? "Bu filtreyle teklif yok." : "No proposals match this filter."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Acceptance chart + win gauge */}
          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display text-[15px] font-semibold tracking-tight">{t(acceptanceMeta.title)}</h3>
                  <p className="text-xs text-muted-foreground">{t(acceptanceMeta.subtitle)}</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                  <ArrowUpRight className="h-3 w-3" />
                  {acceptanceMeta.delta}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-5 text-[11.5px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-3 rounded-full" style={{ background: "var(--color-primary)" }} />
                  {lang === "tr" ? "Kabul edilen" : "Accepted"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-3 rounded-full border border-dashed" style={{ borderColor: "var(--seg-3)" }} />
                  {lang === "tr" ? "Gönderilen" : "Sent"}
                </span>
              </div>
              <div className="mt-2">
                <AcceptanceChart data={acceptance} height={170} />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <h3 className="font-display text-[15px] font-semibold tracking-tight">
                {lang === "tr" ? "Kazanma oranı" : "Win rate"}
              </h3>
              <div className="mt-4 flex items-center gap-5">
                <WinGauge pct={47} />
                <div className="space-y-2.5 text-[13px]">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-success" />
                    <span className="text-muted-foreground">{lang === "tr" ? "Kabul" : "Accepted"}</span>
                    <span className="tnum ml-auto font-semibold">15</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-info" />
                    <span className="text-muted-foreground">{lang === "tr" ? "Beklemede" : "Pending"}</span>
                    <span className="tnum ml-auto font-semibold">12</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-destructive" />
                    <span className="text-muted-foreground">{lang === "tr" ? "Reddedildi" : "Declined"}</span>
                    <span className="tnum ml-auto font-semibold">4</span>
                  </div>
                </div>
              </div>
              <p className="mt-4 rounded-lg bg-muted/50 px-3 py-2 text-[12px] text-muted-foreground">
                {lang === "tr"
                  ? "Görüntülenen teklifler %62 daha sık kapanıyor."
                  : "Viewed proposals close 62% more often."}
              </p>
            </div>
          </div>

          {/* Proposal-builder preview */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ backgroundImage: "var(--grad-brand)" }}>
                  <FileText className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="font-display text-[15px] font-semibold tracking-tight">{t(builderPreview.title)}</h3>
                  <p className="text-[11.5px] text-muted-foreground">
                    {builderPreview.client} · {builderPreview.rep} · {lang === "tr" ? "geçerli" : "valid until"} {fmtDate(builderPreview.validUntil, lang)}
                  </p>
                </div>
              </div>
              <span className="hidden items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary sm:inline-flex">
                <Sparkles className="h-3 w-3" />
                {lang === "tr" ? "AI taslak" : "AI draft"}
              </span>
            </div>

            <div className="grid gap-0 md:grid-cols-[200px_1fr]">
              {/* section nav */}
              <div className="border-b border-border p-3 md:border-b-0 md:border-r">
                <p className="label-mono px-2 pb-1.5 text-muted-foreground">{lang === "tr" ? "Bölümler" : "Sections"}</p>
                <div className="grid grid-cols-2 gap-1 md:grid-cols-1">
                  {current.sections.map((sec, i) => (
                    <span
                      key={sec.key}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium",
                        i === 2 ? "nav-pill-active text-foreground" : "text-foreground/70",
                      )}
                    >
                      <span className="tnum text-[10px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                      <span className="truncate">{t(sec.title)}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* live pricing table */}
              <div className="p-4">
                <p className="label-mono pb-2 text-muted-foreground">{lang === "tr" ? "Fiyatlandırma" : "Pricing"}</p>
                <div className="overflow-hidden rounded-xl border border-border">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 border-b border-border bg-muted/40 px-3 py-2 label-mono text-muted-foreground">
                    <span>{lang === "tr" ? "Kalem" : "Item"}</span>
                    <span className="text-right">{lang === "tr" ? "Birim" : "Unit"}</span>
                    <span className="text-center">{lang === "tr" ? "Adet" : "Qty"}</span>
                    <span className="text-right">{lang === "tr" ? "Tutar" : "Amount"}</span>
                  </div>
                  {items.map((l) => {
                    const active = !l.optional || l.included;
                    return (
                      <div
                        key={l.id}
                        className={cn(
                          "grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-border/60 px-3 py-2.5 last:border-0",
                          !active && "opacity-50",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {l.optional && (
                            <button
                              onClick={() =>
                                setItems((prev) => prev.map((x) => (x.id === l.id ? { ...x, included: !x.included } : x)))
                              }
                              aria-pressed={l.included}
                              className={cn(
                                "grid h-4 w-4 place-items-center rounded-[5px] border transition-colors",
                                l.included ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
                              )}
                            >
                              {l.included && <Check className="h-3 w-3" strokeWidth={3} />}
                            </button>
                          )}
                          <span className="truncate text-[13px] font-medium">
                            {t(l.name)}
                            {l.optional && (
                              <span className="ml-1.5 text-[10px] text-muted-foreground">{lang === "tr" ? "(opsiyonel)" : "(optional)"}</span>
                            )}
                          </span>
                        </div>
                        <span className="tnum text-right text-[13px] text-muted-foreground">{formatUsd(l.unit)}</span>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setItems((prev) => prev.map((x) => (x.id === l.id ? { ...x, qty: Math.max(0, x.qty - 1) } : x)))}
                            className="grid h-5 w-5 place-items-center rounded border border-border text-muted-foreground transition-colors hover:bg-muted"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="tnum w-5 text-center text-[13px] font-semibold">{l.qty}</span>
                          <button
                            onClick={() => setItems((prev) => prev.map((x) => (x.id === l.id ? { ...x, qty: x.qty + 1 } : x)))}
                            className="grid h-5 w-5 place-items-center rounded border border-border text-muted-foreground transition-colors hover:bg-muted"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="tnum text-right text-[13px] font-semibold">{formatUsd(active ? l.unit * l.qty : 0)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
                  <span className="text-[13px] font-semibold">{lang === "tr" ? "Toplam" : "Total"}</span>
                  <span className="tnum text-xl font-bold text-primary">{formatUsd(builderTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Templates strip */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-[15px] font-semibold tracking-tight">
                {lang === "tr" ? "Şablonlar" : "Templates"}
              </h3>
              <Link href="/templates" className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">
                {lang === "tr" ? "Tümünü gör" : "View all"}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {templates.map((tpl) => (
                <button key={tpl.id} className="group rounded-xl border border-border bg-card p-3.5 text-left shadow-pill transition-shadow hover:shadow-pop">
                  <div className="flex h-16 items-center justify-center rounded-lg" style={{ background: `color-mix(in oklch, ${tpl.accent} 14%, white)` }}>
                    <span className="grid h-9 w-9 place-items-center rounded-lg text-white" style={{ background: tpl.accent }}>
                      <FileText className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="mt-2.5 truncate text-[13px] font-semibold">{t(tpl.name)}</p>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{t(tpl.category)}</span>
                    <span className="tnum">{tpl.uses} {lang === "tr" ? "kullanım" : "uses"}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right detail drawer ──────────────────────────────────── */}
        {drawerOpen && (
          <aside className="animate-float-up xl:sticky xl:top-2 xl:self-start">
            <div className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-[15px] font-semibold tracking-tight">
                  {lang === "tr" ? "Teklif detayı" : "Proposal details"}
                </h2>
                <button
                  onClick={() => setDrawerOpen(false)}
                  aria-label={lang === "tr" ? "Kapat" : "Close"}
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* header */}
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
                <ClientAvatar initials={current.clientInitials} size={40} />
                <div className="min-w-0">
                  <p className="truncate font-semibold leading-tight">{t(current.title)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    <span className="tnum">{current.number}</span> · {current.client}
                  </p>
                </div>
              </div>

              {/* value + status */}
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{lang === "tr" ? "Anlaşma değeri" : "Deal value"}</p>
                  <p className="tnum mt-1 text-2xl font-bold leading-none">{formatUsd(current.value)}</p>
                </div>
                <StatusPill status={current.status} lang={lang} />
              </div>

              {/* sections preview */}
              <div>
                <p className="label-mono pb-2 text-muted-foreground">{lang === "tr" ? "Bölümler" : "Sections"}</p>
                <div className="space-y-1.5">
                  {current.sections.map((sec, i) => (
                    <div key={sec.key} className="rounded-lg border border-border bg-card p-2.5">
                      <p className="flex items-center gap-2 text-[12.5px] font-semibold">
                        <span className="tnum text-[10px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                        {t(sec.title)}
                      </p>
                      <p className="mt-0.5 line-clamp-1 pl-6 text-[11px] text-muted-foreground">{t(sec.preview)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* view timeline */}
              <div>
                <p className="label-mono pb-2 text-muted-foreground">{lang === "tr" ? "Görüntüleme zaman çizelgesi" : "View timeline"}</p>
                {current.timeline.length === 0 ? (
                  <p className="rounded-lg bg-muted/50 px-3 py-2 text-[12px] text-muted-foreground">
                    {lang === "tr" ? "Henüz hareket yok — taslak." : "No activity yet — it's a draft."}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {current.timeline.map((ev, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className="relative mt-0.5 flex flex-col items-center">
                          <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/10 text-primary">
                            {i === current.timeline.length - 1 && current.signed ? <Check className="h-3 w-3" strokeWidth={3} /> : <Clock className="h-3 w-3" />}
                          </span>
                          {i < current.timeline.length - 1 && <span className="mt-0.5 h-5 w-px bg-border" />}
                        </span>
                        <div className="min-w-0 text-[12.5px]">
                          <p className="font-medium leading-tight">{t(ev.label)}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {fmtTime(ev.at)}
                            {ev.section && ` · ${t(ev.section)}`}
                            {ev.seconds ? ` · ${Math.round(ev.seconds / 60) || 1}m` : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-[11.5px] font-medium text-muted-foreground">
                  <Eye className="h-3.5 w-3.5" />
                  {t(current.viewSummary)}
                </p>
              </div>

              {/* e-sign status */}
              <div className="flex items-center gap-3 rounded-xl border border-border p-3">
                <span
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                    current.signed ? "bg-success/12 text-success" : "bg-muted text-muted-foreground",
                  )}
                >
                  <PenLine className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold">{lang === "tr" ? "E-imza" : "E-signature"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {current.signed
                      ? lang === "tr" ? "İmzalandı ve kabul edildi" : "Signed and accepted"
                      : current.status === "declined"
                        ? lang === "tr" ? "Reddedildi" : "Declined"
                        : lang === "tr" ? "İmza bekleniyor" : "Awaiting signature"}
                  </p>
                </div>
                {current.signed && (
                  <svg viewBox="0 0 80 24" className="h-6 w-20 text-success" aria-hidden>
                    <path d="M4 18 C14 6 18 20 28 14 C36 9 42 19 52 12 C60 7 68 16 76 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="sign-draw" style={{ ["--len" as string]: 130 }} />
                  </svg>
                )}
              </div>

              {/* actions */}
              <div className="grid grid-cols-2 gap-2">
                <button className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card py-2.5 text-[13px] font-semibold transition-colors hover:bg-muted">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  {lang === "tr" ? "Hatırlat" : "Send reminder"}
                </button>
                <button className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90">
                  <ArrowUpRight className="h-4 w-4" />
                  {lang === "tr" ? "Teklifi aç" : "Open proposal"}
                </button>
              </div>
            </div>

            {/* Activity feed */}
            <div className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-soft">
              <h3 className="font-display text-[15px] font-semibold tracking-tight">
                {lang === "tr" ? "Son hareketler" : "Recent activity"}
              </h3>
              <div className="mt-3.5 space-y-3.5">
                {activity.map((a) => (
                  <div key={a.id} className="flex items-start gap-2.5">
                    <span
                      className={cn(
                        "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                        a.tone === "success" ? "bg-success" : a.tone === "warning" ? "bg-warning" : a.tone === "info" ? "bg-info" : "bg-muted-foreground",
                      )}
                    />
                    <div className="min-w-0 text-[13px]">
                      <p className="leading-snug">
                        <span className="font-semibold">{a.who}</span>{" "}
                        <span className="text-muted-foreground">{t(a.action)}</span>{" "}
                        <span className="tnum font-medium">{a.target}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">{formatRelative(a.at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
