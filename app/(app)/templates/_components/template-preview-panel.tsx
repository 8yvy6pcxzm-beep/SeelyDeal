"use client";

import { FileText, Sparkles, Type, Palette } from "lucide-react";
import { WinGauge } from "@/components/app/charts";
import { BlockRenderer } from "@/components/app/blocks/block-renderer";
import { legacyToBlocks } from "@/lib/proposal-blocks/convert-legacy";
import { PROPOSAL_FONT_LABELS, isProposalFontKey } from "@/lib/proposal-fonts";
import type { Template } from "@/lib/demo/data";

/** A scaled-down "sheet" mock that actually uses the template's theme colors/font —
 *  unlike the card wireframes (accent-only), this is what a proposal drafted from
 *  this visual template would look like once the AI fills in the client's content. */
function VisualThemePreview({ current, lang }: { current: Template; lang: "tr" | "en" }) {
  const primary = current.theme?.primaryColor || current.accent;
  const accent = current.theme?.accentColor || current.accent;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-inner">
      <div className="h-14 px-4 py-3" style={{ background: `linear-gradient(135deg, ${primary}, color-mix(in oklch, ${primary} 55%, black))` }}>
        <div className="h-2 w-20 rounded-full bg-white/70" />
        <div className="mt-1.5 h-1.5 w-32 rounded-full bg-white/40" />
      </div>
      <div className="space-y-2 p-4">
        <div className="h-1.5 w-full rounded-full bg-muted" />
        <div className="h-1.5 w-5/6 rounded-full bg-muted" />
        <div className="h-1.5 w-2/3 rounded-full bg-muted" />
        <div className="mt-3 flex items-center justify-between rounded-lg border border-border px-2.5 py-1.5">
          <div className="h-1.5 w-16 rounded-full bg-muted" />
          <span className="rounded-md px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: accent }}>
            {lang === "tr" ? "Öne çıkan" : "Featured"}
          </span>
        </div>
      </div>
    </div>
  );
}

export function TemplatePreviewPanel({
  current,
  lang,
  t,
  savingDefault,
  onDraft,
  onSaveAsDefault,
}: {
  current: Template;
  lang: "tr" | "en";
  t: (l: { tr: string; en: string }) => string;
  savingDefault: boolean;
  onDraft: () => void;
  onSaveAsDefault: () => void;
}) {
  const fontKey = isProposalFontKey(current.theme?.font) ? current.theme!.font : "default";

  return (
    <aside className="space-y-5 lg:sticky lg:top-2 lg:self-start">
      <div className="glass-card p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: current.theme?.primaryColor || current.accent }}>
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-[15px] font-semibold tracking-tight">{t(current.name)}</p>
            <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              {t(current.category)}
              {current.kind === "draft" ? (
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  {lang === "tr" ? "Taslak" : "Draft"}
                </span>
              ) : (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {lang === "tr" ? "Tasarım / Tema" : "Design / Theme"}
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

        {current.kind === "draft" ? (
          <div className="mt-5 space-y-3">
            <BlockRenderer
              blocks={legacyToBlocks({
                sections: current.sections.map((sec) => ({ title: t(sec.title), body: t(sec.body) })),
                lineItems: current.lineItems,
                contractText: current.contractText ? t(current.contractText) : undefined,
              })}
              ctx={{
                title: t(current.name),
                client: lang === "tr" ? "Müşteri" : "Client",
                value: (current.lineItems ?? []).reduce((sum, li) => sum + li.qty * li.unit, 0),
                lineItems: (current.lineItems ?? []).map((li, i) => ({ id: String(i), name: t(li.name), unit: li.unit, qty: li.qty })),
                lang,
              }}
            />
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div>
              <p className="label-mono pb-2 text-muted-foreground">{lang === "tr" ? "Canlı önizleme" : "Live preview"}</p>
              <VisualThemePreview current={current} lang={lang} />
            </div>

            <div>
              <p className="label-mono pb-2 text-muted-foreground">{lang === "tr" ? "Tema" : "Theme"}</p>
              <div className="space-y-2 rounded-lg border border-border bg-card px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[12.5px]">{lang === "tr" ? "Ana renk" : "Primary"}</span>
                  <span
                    className="ml-auto h-4 w-4 rounded-full border border-border"
                    style={{ background: current.theme?.primaryColor || current.accent }}
                  />
                  {current.theme?.primaryColor && (
                    <span className="tnum text-[11px] text-muted-foreground">{current.theme.primaryColor}</span>
                  )}
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-[12.5px]">{lang === "tr" ? "Aksan rengi" : "Accent"}</span>
                  <span
                    className="ml-auto h-4 w-4 rounded-full border border-border"
                    style={{ background: current.theme?.accentColor || current.accent }}
                  />
                  {current.theme?.accentColor && (
                    <span className="tnum text-[11px] text-muted-foreground">{current.theme.accentColor}</span>
                  )}
                </div>
                <div className="flex items-center gap-2.5 border-t border-border pt-2">
                  <Type className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[12.5px]">{lang === "tr" ? "Yazı tipi" : "Font"}</span>
                  <span className="ml-auto text-[12px] font-medium">{t(PROPOSAL_FONT_LABELS[fontKey])}</span>
                </div>
              </div>
            </div>

            <p className="rounded-lg bg-muted/40 px-3 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
              {lang === "tr"
                ? "Görsel şablonlar sadece tasarımı belirler — AI kendi içeriğini bu tema ile yazar, örnek metin kopyalamaz."
                : "Visual templates set only the design — the AI writes fresh content in this theme, it never copies placeholder text."}
            </p>
          </div>
        )}

        <button
          onClick={onDraft}
          className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-[13px] font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
        >
          <Sparkles className="h-4 w-4" />
          {lang === "tr" ? "AI ile bu şablonu işle" : "Process with AI"}
        </button>

        {current.kind === "draft" && (
          <button
            onClick={onSaveAsDefault}
            disabled={savingDefault}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2.5 text-[13px] font-semibold transition-colors hover:bg-muted disabled:opacity-50"
          >
            {savingDefault
              ? lang === "tr" ? "Kaydediliyor…" : "Saving…"
              : lang === "tr" ? "Bu taslağı varsayılan yap" : "Make this the default"}
          </button>
        )}
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
  );
}
