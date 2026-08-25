"use client";

import { Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Template } from "@/lib/demo/data";
import { TemplateMiniCover } from "@/components/app/template-mini-cover";

/** Card for a "Görsel Şablon" group (kind unset — a pure design/theme skeleton,
 *  see Template.kind in lib/demo/data.ts). Deliberately shows no text preview:
 *  the AI never reads a visual template's section copy, only its accent/theme
 *  (see resolvedTemplateBlock in app/api/draft-proposal/prompts.ts), so a text
 *  snippet here would misleadingly imply otherwise. The badge makes that explicit. */
export function VisualTemplateCard({
  group,
  selected,
  lang,
  t,
  onSelect,
}: {
  group: Template[];
  selected: string;
  lang: "tr" | "en";
  t: (l: { tr: string; en: string }) => string;
  onSelect: (id: string) => void;
}) {
  const active = group.find((tpl) => tpl.id === selected) ?? group[0];
  const isSel = group.some((tpl) => tpl.id === selected);

  return (
    <button
      onClick={() => onSelect(active.id)}
      className={cn(
        "glass-card group p-4 text-left",
        isSel && "border-primary/40 ring-1 ring-primary/20",
      )}
    >
      {/* preview — a static cover image when set, otherwise a theme-driven mini
          cover generated from the template's colors; never section text (the
          AI never reads a visual template's section copy, only its theme/accent) */}
      {active.previewImage ? (
        <div className="relative h-32 w-full overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={active.previewImage}
            alt=""
            className="h-full w-full object-cover"
            aria-hidden
          />
        </div>
      ) : (
        <TemplateMiniCover
          primaryColor={active.theme?.primaryColor ?? active.accent}
          accentColor={active.theme?.accentColor ?? active.accent}
        />
      )}

      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold tracking-tight">{t(active.category)}</p>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Palette className="h-2.5 w-2.5" />
            {lang === "tr" ? "Tasarım / Tema" : "Design / Theme"}
          </span>
          {group.length > 1 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              {group.map((variant) => (
                <span
                  key={variant.id}
                  role="button"
                  tabIndex={0}
                  aria-label={lang === "tr" ? "Varyant seç" : "Select variant"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(variant.id);
                  }}
                  className={cn(
                    "h-2 w-2 rounded-full transition-colors",
                    variant.id === active.id ? "bg-primary" : "bg-muted hover:bg-muted-foreground/40",
                  )}
                />
              ))}
            </div>
          )}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
          {active.winRate}% {lang === "tr" ? "kazanç" : "win"}
        </span>
      </div>
      <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2.5 text-[11.5px] text-muted-foreground">
        <span className="tnum">{active.uses} {lang === "tr" ? "kullanım" : "uses"}</span>
        <span className="inline-flex items-center gap-1 font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
          {lang === "tr" ? "Kullan" : "Use"}
        </span>
      </div>
    </button>
  );
}
