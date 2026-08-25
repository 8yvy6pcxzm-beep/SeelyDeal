"use client";

import { Check, Eye, PenLine } from "lucide-react";
import { useLang } from "@/components/i18n/language-provider";
import { formatUsd } from "@/lib/utils";

/* ── Inline-SVG fake-company wordmarks for the trusted-by row ───────────────── */
export function CompanyMark({ name }: { name: string }) {
  const glyphs: Record<string, React.ReactNode> = {
    Northwind: <path d="M3 17 L9 4 L12 11 L15 4 L21 17" />,
    Parable: <circle cx="12" cy="11" r="7" />,
    Formwork: <path d="M4 5 h16 v4 h-6 v9 h-4 v-9 h-6 z" />,
    Cedarworks: <path d="M12 3 L20 18 H4 Z M12 9 L16 17 H8 Z" />,
    Lumen: <path d="M6 4 v14 h10" />,
    Harvest: <path d="M12 4 c5 4 5 10 0 14 c-5 -4 -5 -10 0 -14 z" />,
    Brightline: <path d="M4 12 h16 M12 5 v14" />,
    Meridian: <path d="M4 18 L9 6 L12 14 L15 6 L20 18" />,
  };
  return (
    <span className="inline-flex items-center gap-2 text-muted-foreground/70">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {glyphs[name]}
      </svg>
      <span className="text-[15px] font-semibold tracking-tight">{name}</span>
    </span>
  );
}

/* ── App-window frame: gives static preview cards a live-product feel ──────── */
export function AppWindowFrame({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="app-window">
      <div className="app-window-bar">
        <span className="app-window-dot" />
        <span className="app-window-dot" />
        <span className="app-window-dot" />
        {label && <span className="ml-2 truncate text-[11px] font-medium text-muted-foreground">{label}</span>}
      </div>
      {children}
    </div>
  );
}

/* ── Hero product-preview card: a beautiful proposal + pricing table ───────── */
export function ProductPreview() {
  const { lang } = useLang();
  const items = [
    { name: lang === "tr" ? "Marka sistemi" : "Brand system", amount: 7600 },
    { name: lang === "tr" ? "Web sitesi · 8 sayfa" : "Website · 8 pages", amount: 7600 },
    { name: lang === "tr" ? "Keşif & strateji" : "Discovery & strategy", amount: 3200 },
  ];
  const total = items.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="relative w-full">
      <AppWindowFrame label={lang === "tr" ? "seelydeal.app · teklif önizleme" : "seelydeal.app · proposal preview"}>
      {/* proposal cover band with gradient */}
      <div className="relative overflow-hidden px-5 pb-4 pt-5" style={{ backgroundImage: "var(--grad-brand)" }}>
        <span className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/15 blur-2xl" aria-hidden />
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/70">
          {lang === "tr" ? "Northwind için teklif" : "Proposal for Northwind"}
        </p>
        <p className="mt-1.5 font-display text-[19px] font-bold leading-tight text-white">
          {lang === "tr" ? "Marka yenileme & web sitesi" : "Brand refresh & website"}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-[#c9f56b] pulse-dot" />
            <Eye className="h-3 w-3" /> {lang === "tr" ? "3× görüntülendi" : "Viewed 3×"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white">
            PRO-2048
          </span>
        </div>
      </div>

      {/* pricing table */}
      <div className="p-4">
        <p className="label-mono pb-2 text-muted-foreground">{lang === "tr" ? "Fiyatlandırma" : "Pricing"}</p>
        <div className="overflow-hidden rounded-xl border border-border">
          {items.map((it, i) => (
            <div key={it.name} className={`flex items-center justify-between px-3 py-2.5 text-[12.5px] ${i < items.length - 1 ? "border-b border-border/60" : ""}`}>
              <span className="truncate font-medium">{it.name}</span>
              <span className="tnum font-semibold">{formatUsd(it.amount)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-muted/50 px-3.5 py-2.5">
          <span className="text-[12.5px] font-semibold">{lang === "tr" ? "Toplam" : "Total"}</span>
          <span className="tnum text-lg font-bold text-primary">{formatUsd(total)}</span>
        </div>

        {/* signature row */}
        <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-border bg-card p-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-success/12 text-success">
            <Check className="h-4 w-4" strokeWidth={3} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold leading-tight">{lang === "tr" ? "Kabul edildi & imzalandı" : "Accepted & signed"}</p>
            <p className="text-[10.5px] text-muted-foreground">Maria Gomez · Northwind</p>
          </div>
          <svg viewBox="0 0 64 22" className="h-5 w-16 text-primary" aria-hidden>
            <path d="M3 16 C12 5 16 18 25 12 C32 7 38 17 47 10 C53 6 58 14 61 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>
      </AppWindowFrame>

      {/* floating "opened" chip */}
      <div className="absolute -bottom-3 left-5 hidden items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-semibold shadow-pop sm:inline-flex">
        <PenLine className="h-3 w-3 text-primary" />
        {lang === "tr" ? "tek tıkla imza" : "one-click sign"}
      </div>
    </div>
  );
}
