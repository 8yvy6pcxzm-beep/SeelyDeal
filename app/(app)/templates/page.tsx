"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, FileText, Sparkles, ArrowUpRight, Search } from "lucide-react";
import { WinGauge } from "@/components/app/charts";
import { useLang } from "@/components/i18n/language-provider";
import { cn } from "@/lib/utils";
import { templates as demoTemplates, type Template } from "@/lib/demo/data";
import { TemplateHtmlBlock } from "@/components/app/template-html-block";
import { AiDraftDialog } from "@/components/app/ai-draft-dialog";
import { usePlan } from "@/components/app/plan-provider";
import { planAllows } from "@/lib/plan";

type RealTemplateRow = {
  id: string;
  name: string;
  industry: string | null;
  sections: { title: string; body: string }[];
  line_items: unknown[];
  contract_text: string | null;
  intro_text: string | null;
  about_text: string | null;
  next_steps: unknown[];
  billing_options: unknown[];
  valid_days: number;
};

export default function TemplatesPage() {
  return (
    <Suspense fallback={null}>
      <TemplatesPageInner />
    </Suspense>
  );
}

function TemplatesPageInner() {
  const { t, lang } = useLang();
  const plan = usePlan();
  const router = useRouter();
  const searchParams = useSearchParams();
  const useParam = searchParams.get("use");
  const [realRows, setRealRows] = useState<RealTemplateRow[]>([]);
  const [aiOpen, setAiOpen] = useState(false);

  async function loadReal() {
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      setRealRows(data.templates ?? []);
    } catch {
      setRealRows([]);
    }
  }

  useEffect(() => {
    loadReal();
  }, []);

  const templates: Template[] = useMemo(
    () => [
      ...realRows.map((r) => ({
        id: r.id,
        name: { tr: r.name, en: r.name },
        category: { tr: r.industry || "Özel", en: r.industry || "Custom" },
        uses: 0,
        winRate: 0,
        accent: "var(--seg-1)",
        sections: r.sections.map((s) => ({ title: { tr: s.title, en: s.title }, body: { tr: s.body, en: s.body } })),
      })),
      ...demoTemplates,
    ],
    [realRows],
  );

  const [selected, setSelected] = useState(
    (useParam && templates.some((tpl) => tpl.id === useParam)) ? useParam : templates[0].id,
  );
  const current = templates.find((tpl) => tpl.id === selected) ?? templates[0];

  // Group templates by category (sector) — a sector with multiple named variants
  // (ör. İnşaat — Sade / İnşaat — Leo) renders as ONE card with a variant switcher
  // inside, instead of one full card per variant.
  const groups = useMemo(() => {
    const byCategory = new Map<string, Template[]>();
    for (const tpl of templates) {
      const key = tpl.category.tr;
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key)!.push(tpl);
    }
    return Array.from(byCategory.values());
  }, [templates]);
  const canCreateTemplates = planAllows(plan, "templates_create");

  function draftFromCurrent() {
    // Hand off just the template's id — the AI chat resolves it server-side and
    // writes real content (blended with the company's own doc library, if any)
    // instead of us dumping raw template text (with unfilled placeholders) here.
    sessionStorage.setItem("seelydeal:draftFromTemplate", JSON.stringify({ templateId: current.id }));
    router.push("/proposals?fromTemplate=1");
  }

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
          <button
            onClick={() => setAiOpen(true)}
            disabled={!canCreateTemplates}
            title={!canCreateTemplates ? (lang === "tr" ? "Pro veya üstü plan gerekir" : "Requires Pro plan or higher") : undefined}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {lang === "tr" ? "Yeni şablon" : "New template"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-primary/25 bg-primary/[0.06] px-4 py-2.5 text-[13px] text-primary">
        {lang === "tr"
          ? "Örnek şablonlar + kendi oluşturduğun şablonlar."
          : "Sample templates + the ones you've created."}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Template grid — one card per sector; multi-variant sectors get a Sade/Leo switcher inside */}
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((group) => {
            // Which variant of this group is currently shown: whichever one is `selected`, else the first.
            const active = group.find((tpl) => tpl.id === selected) ?? group[0];
            const isSel = group.some((tpl) => tpl.id === selected);
            return (
              <button
                key={active.category.tr}
                onClick={() => setSelected(active.id)}
                className={cn(
                  "group rounded-2xl border bg-card p-4 text-left shadow-soft transition-all hover:shadow-pop",
                  isSel ? "border-primary/40 ring-1 ring-primary/20" : "border-border",
                )}
              >
                {/* preview */}
                <div className="relative flex h-32 items-center justify-center overflow-hidden rounded-xl" style={{ background: `color-mix(in oklch, ${active.accent} 12%, white)` }}>
                  <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-30 blur-xl" style={{ background: active.accent }} aria-hidden />
                  <div className="w-28 rounded-lg border border-border bg-card p-2.5 shadow-pill">
                    <div className="h-2 w-12 rounded-full" style={{ background: active.accent }} />
                    <div className="mt-2 space-y-1">
                      <div className="h-1.5 w-full rounded-full bg-muted" />
                      <div className="h-1.5 w-3/4 rounded-full bg-muted" />
                      <div className="h-1.5 w-5/6 rounded-full bg-muted" />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="h-2 w-8 rounded-full bg-muted" />
                      <div className="h-2 w-6 rounded-full" style={{ background: active.accent }} />
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold tracking-tight">{t(active.category)}</p>
                    {group.length > 1 ? (
                      <div className="mt-1.5 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {group.map((variant) => (
                          <span
                            key={variant.id}
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected(variant.id);
                            }}
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors",
                              variant.id === active.id
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:bg-muted/70",
                            )}
                          >
                            {variant.nickname ? variant.nickname : lang === "tr" ? "Sade" : "Simple"}
                          </span>
                        ))}
                      </div>
                    ) : (
                      active.variant && (
                        <p className="text-[11px] text-muted-foreground">
                          {active.nickname ? active.nickname : active.variant === "kapsamli" ? (lang === "tr" ? "Kapsamlı" : "Comprehensive") : lang === "tr" ? "Sade" : "Simple"}
                        </p>
                      )
                    )}
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                    {active.winRate}% {lang === "tr" ? "kazanç" : "win"}
                  </span>
                </div>
                <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2.5 text-[11.5px] text-muted-foreground">
                  <span className="tnum">{active.uses} {lang === "tr" ? "kullanım" : "uses"}</span>
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
                <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                  {t(current.category)}
                  {current.variant && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                      {current.nickname ? current.nickname : lang === "tr" ? "Sade" : "Simple"}
                    </span>
                  )}
                </p>
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
              <div className="space-y-2">
                {current.sections.map((sec, i) => (
                  <div key={sec.title.en} className="rounded-lg border border-border bg-card px-2.5 py-2">
                    <div className="flex items-center gap-2.5">
                      <span className="tnum text-[10px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                      <span className="text-[13px] font-medium">{t(sec.title)}</span>
                    </div>
                    {sec.html ? (
                      <TemplateHtmlBlock html={sec.html} />
                    ) : (
                      <p className="mt-1 pl-[26px] text-[12px] leading-relaxed text-muted-foreground">{t(sec.body)}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={draftFromCurrent}
              className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-[13px] font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
            >
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

      <AiDraftDialog
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onSaved={() => {
          setAiOpen(false);
          loadReal();
        }}
        mode="template"
      />
    </div>
  );
}
