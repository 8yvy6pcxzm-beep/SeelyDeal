"use client";

import { useState } from "react";
import { Plus, FileText, Sparkles, ArrowUpRight, Search } from "lucide-react";
import { WinGauge } from "@/components/app/charts";
import { useLang } from "@/components/i18n/language-provider";
import { cn } from "@/lib/utils";
import { templates } from "@/lib/demo/data";
import type { L } from "@/lib/i18n/config";

const SECTIONS: L[] = [
  { tr: "Kapak", en: "Cover" },
  { tr: "Kapsam", en: "Scope" },
  { tr: "Fiyatlandırma", en: "Pricing" },
  { tr: "Şartlar", en: "Terms" },
  { tr: "İmza", en: "Signature" },
];

export default function TemplatesPage() {
  const { t, lang } = useLang();
  const [selected, setSelected] = useState(templates[0].id);
  const current = templates.find((tpl) => tpl.id === selected) ?? templates[0];

  return (
    <div className="mx-auto max-w-[1200px] animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {lang === "tr" ? "Şablonlar" : "Templates"}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {lang === "tr"
              ? "Onaylı, markaya uygun başlangıç noktaları. AI buradan yazmaya başlar."
              : "Approved, on-brand starting points. The AI drafts from here."}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm sm:flex">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              placeholder={lang === "tr" ? "Şablon ara…" : "Search templates…"}
              className="w-36 bg-transparent text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
            />
          </div>
          <button className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90">
            <Plus className="h-4 w-4" />
            {lang === "tr" ? "Yeni şablon" : "New template"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Template grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          {templates.map((tpl) => {
            const isSel = tpl.id === selected;
            return (
              <button
                key={tpl.id}
                onClick={() => setSelected(tpl.id)}
                className={cn(
                  "group rounded-2xl border bg-card p-4 text-left shadow-soft transition-all hover:shadow-pop",
                  isSel ? "border-primary/40 ring-1 ring-primary/20" : "border-border",
                )}
              >
                {/* preview */}
                <div className="relative flex h-32 items-center justify-center overflow-hidden rounded-xl" style={{ background: `color-mix(in oklch, ${tpl.accent} 12%, white)` }}>
                  <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-30 blur-xl" style={{ background: tpl.accent }} aria-hidden />
                  <div className="w-28 rounded-lg border border-border bg-card p-2.5 shadow-pill">
                    <div className="h-2 w-12 rounded-full" style={{ background: tpl.accent }} />
                    <div className="mt-2 space-y-1">
                      <div className="h-1.5 w-full rounded-full bg-muted" />
                      <div className="h-1.5 w-3/4 rounded-full bg-muted" />
                      <div className="h-1.5 w-5/6 rounded-full bg-muted" />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="h-2 w-8 rounded-full bg-muted" />
                      <div className="h-2 w-6 rounded-full" style={{ background: tpl.accent }} />
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold tracking-tight">{t(tpl.name)}</p>
                    <p className="text-[11px] text-muted-foreground">{t(tpl.category)}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                    {tpl.winRate}% {lang === "tr" ? "kazanç" : "win"}
                  </span>
                </div>
                <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2.5 text-[11.5px] text-muted-foreground">
                  <span className="tnum">{tpl.uses} {lang === "tr" ? "kullanım" : "uses"}</span>
                  <span className="inline-flex items-center gap-1 font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    {lang === "tr" ? "Kullan" : "Use"} <ArrowUpRight className="h-3 w-3" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail rail */}
        <aside className="space-y-5 lg:sticky lg:top-2 lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: current.accent }}>
                <FileText className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-[15px] font-semibold tracking-tight">{t(current.name)}</p>
                <p className="text-[11.5px] text-muted-foreground">{t(current.category)}</p>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-4">
              <WinGauge pct={current.winRate} size={84} />
              <div className="space-y-1 text-[13px]">
                <p className="text-muted-foreground">{lang === "tr" ? "Kazanma oranı" : "Win rate"}</p>
                <p className="tnum text-xl font-bold">{current.winRate}%</p>
                <p className="tnum text-[11.5px] text-muted-foreground">{current.uses} {lang === "tr" ? "kez kullanıldı" : "times used"}</p>
              </div>
            </div>

            <div className="mt-5">
              <p className="label-mono pb-2 text-muted-foreground">{lang === "tr" ? "Bölümler" : "Sections"}</p>
              <div className="space-y-1.5">
                {SECTIONS.map((sec, i) => (
                  <div key={sec.en} className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-2.5 py-2">
                    <span className="tnum text-[10px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-[13px] font-medium">{t(sec)}</span>
                  </div>
                ))}
              </div>
            </div>

            <button className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90">
              <Sparkles className="h-4 w-4" />
              {lang === "tr" ? "Bu şablonla yaz" : "Draft from this template"}
            </button>
          </div>

          <div className="rounded-2xl border border-border bg-muted/30 p-5 shadow-soft">
            <p className="text-[13px] font-semibold">{lang === "tr" ? "İpucu" : "Pro tip"}</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
              {lang === "tr"
                ? "En yüksek kazanma oranlı şablonlardan başla; AI geçmiş kazananlarından öğrenir."
                : "Start from your highest win-rate templates; the AI learns from your past winners."}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
