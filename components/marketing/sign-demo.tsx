"use client";

import { useMemo, useState } from "react";
import { Check, Plus, Minus, PenLine, RotateCcw } from "lucide-react";
import { useLang } from "@/components/i18n/language-provider";
import { cn, formatUsd } from "@/lib/utils";
import type { L } from "@/lib/i18n/config";

interface DemoItem {
  id: string;
  name: L;
  unit: number;
  qty: number;
  optional?: boolean;
  included: boolean;
  qtyAdjustable?: boolean;
}

const INITIAL: DemoItem[] = [
  { id: "d1", name: { tr: "Marka sistemi", en: "Brand system" }, unit: 7600, qty: 1, included: true },
  { id: "d2", name: { tr: "Web sitesi (sayfa başı)", en: "Website (per page)" }, unit: 950, qty: 6, included: true, qtyAdjustable: true },
  { id: "d3", name: { tr: "Sosyal medya kiti", en: "Social media kit" }, unit: 1800, qty: 1, optional: true, included: true },
  { id: "d4", name: { tr: "Aylık bakım paketi", en: "Monthly care plan" }, unit: 600, qty: 6, optional: true, included: false, qtyAdjustable: true },
];

/**
 * The interactive landing demo: clients toggle optional line items and adjust
 * quantities (the total recomputes live), then hit "Accept & sign" and a
 * signature stroke animates in. Pure useState, no deps, inline SVG.
 */
export function SignDemo() {
  const { lang } = useLang();
  const [items, setItems] = useState<DemoItem[]>(() => INITIAL.map((i) => ({ ...i })));
  const [signed, setSigned] = useState(false);

  const total = useMemo(
    () => items.reduce((sum, l) => (l.included ? sum + l.unit * l.qty : sum), 0),
    [items],
  );

  const toggle = (id: string) => {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, included: !x.included } : x)));
    setSigned(false);
  };
  const bump = (id: string, d: number) => {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, qty: Math.max(1, x.qty + d) } : x)));
    setSigned(false);
  };
  const reset = () => {
    setItems(INITIAL.map((i) => ({ ...i })));
    setSigned(false);
  };

  return (
    <div className="glass-card overflow-hidden">
      {/* gradient cover */}
      <div className="relative overflow-hidden px-5 py-4" style={{ backgroundImage: "var(--grad-brand)" }}>
        <span className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/15 blur-2xl" aria-hidden />
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/70">
          {lang === "tr" ? "Etkileşimli teklif" : "Interactive proposal"}
        </p>
        <p className="mt-1 font-display text-[18px] font-bold text-white">
          {lang === "tr" ? "Paketini seç" : "Build your package"}
        </p>
      </div>

      <div className="p-4">
        {/* pricing table */}
        <div className="overflow-hidden rounded-xl border border-border">
          {items.map((l, i) => (
            <div
              key={l.id}
              className={cn(
                "grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-2.5 transition-colors",
                i < items.length - 1 && "border-b border-border/60",
                !l.included && "opacity-50",
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                {l.optional ? (
                  <button
                    onClick={() => toggle(l.id)}
                    aria-pressed={l.included}
                    className={cn(
                      "grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors",
                      l.included ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-transparent",
                    )}
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </button>
                ) : (
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-success/12 text-success">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">
                    {l.name[lang]}
                    {l.optional && (
                      <span className="ml-1.5 text-[10px] text-muted-foreground">{lang === "tr" ? "(opsiyonel)" : "(optional)"}</span>
                    )}
                  </p>
                  <p className="tnum text-[10.5px] text-muted-foreground">{formatUsd(l.unit)} {lang === "tr" ? "/ birim" : "/ unit"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                {l.qtyAdjustable && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => bump(l.id, -1)} className="grid h-5 w-5 place-items-center rounded border border-border text-muted-foreground transition-colors hover:bg-muted">
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="tnum w-5 text-center text-[12px] font-semibold">{l.qty}</span>
                    <button onClick={() => bump(l.id, 1)} className="grid h-5 w-5 place-items-center rounded border border-border text-muted-foreground transition-colors hover:bg-muted">
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <span className="tnum w-16 text-right text-[13px] font-semibold">{formatUsd(l.included ? l.unit * l.qty : 0)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* total */}
        <div className="mt-3 flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
          <span className="text-[13px] font-semibold">{lang === "tr" ? "Toplam" : "Total"}</span>
          <span className="tnum text-2xl font-bold text-primary tabular-nums">{formatUsd(total)}</span>
        </div>

        {/* accept & sign */}
        {!signed ? (
          <button
            onClick={() => setSigned(true)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-[14px] font-semibold text-primary-foreground shadow-glow transition-opacity hover:opacity-90"
          >
            <PenLine className="h-4 w-4" />
            {lang === "tr" ? "Kabul et & imzala" : "Accept & sign"}
          </button>
        ) : (
          <div className="mt-3 animate-float-up rounded-xl border border-success/30 bg-success/[0.06] p-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-success text-success-foreground">
                <Check className="h-4 w-4" strokeWidth={3} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold">{lang === "tr" ? "Kabul edildi & imzalandı" : "Accepted & signed"}</p>
                <p className="text-[11px] text-muted-foreground">
                  {lang === "tr" ? "Maria Gomez · az önce · yasal olarak bağlayıcı" : "Maria Gomez · just now · legally binding"}
                </p>
              </div>
              <button onClick={reset} aria-label="Reset" className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
            {/* animated signature */}
            <svg viewBox="0 0 200 44" className="mt-2 h-11 w-full text-primary" aria-hidden>
              <path
                d="M10 30 C30 8 40 38 60 24 C76 13 88 34 106 22 C120 13 132 32 150 20 C164 11 178 26 190 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="sign-draw"
                style={{ ["--len" as string]: 320 }}
              />
            </svg>
          </div>
        )}
        <p className="mt-2.5 text-center text-[11px] text-muted-foreground">
          {lang === "tr"
            ? "Seçenekleri aç/kapat, adetleri ayarla — toplam canlı güncellenir."
            : "Toggle options and adjust quantities — the total updates live."}
        </p>
      </div>
    </div>
  );
}
