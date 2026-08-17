"use client";

import { Plus, Search, Palette, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export type TemplateTab = "visual" | "draft";

export function TemplateHeader({
  lang,
  tab,
  onTabChange,
  visualCount,
  draftCount,
  query,
  onQueryChange,
  category,
  onCategoryChange,
  categories,
  canCreateTemplates,
  onNewTemplate,
}: {
  lang: "tr" | "en";
  tab: TemplateTab;
  onTabChange: (tab: TemplateTab) => void;
  visualCount: number;
  draftCount: number;
  query: string;
  onQueryChange: (q: string) => void;
  category: string | null;
  onCategoryChange: (c: string | null) => void;
  categories: string[];
  canCreateTemplates: boolean;
  onNewTemplate: () => void;
}) {
  return (
    <div className="space-y-4">
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
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={lang === "tr" ? "Şablon veya sektör ara…" : "Search templates or sectors…"}
              className="w-44 bg-transparent text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
            />
          </div>
          <button
            onClick={onNewTemplate}
            disabled={!canCreateTemplates}
            title={!canCreateTemplates ? (lang === "tr" ? "Pro veya üstü plan gerekir" : "Requires Pro plan or higher") : undefined}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {lang === "tr" ? "Yeni şablon" : "New template"}
          </button>
        </div>
      </div>

      {/* Tab switcher: the same kind: "draft" split the AI/data layer already uses */}
      <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/40 p-1 text-[13px] font-medium">
        <button
          onClick={() => onTabChange("visual")}
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 transition-colors sm:flex-none sm:px-4",
            tab === "visual" ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Palette className="h-3.5 w-3.5" />
          {lang === "tr" ? "Görsel Şablonlar" : "Visual Templates"}
          <span className="tnum rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{visualCount}</span>
        </button>
        <button
          onClick={() => onTabChange("draft")}
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 transition-colors sm:flex-none sm:px-4",
            tab === "draft" ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <FileText className="h-3.5 w-3.5" />
          {lang === "tr" ? "Taslak Teklif Örnekleri" : "Draft Proposal Examples"}
          <span className="tnum rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{draftCount}</span>
        </button>
      </div>

      {categories.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => onCategoryChange(null)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors",
              category === null ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {lang === "tr" ? "Tümü" : "All"}
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => onCategoryChange(c)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors",
                category === c ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
