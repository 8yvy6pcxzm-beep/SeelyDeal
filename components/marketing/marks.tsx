"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { Check, Loader2, PenLine, Sparkles } from "lucide-react";
import { useLang } from "@/components/i18n/language-provider";
import { cn, formatUsd } from "@/lib/utils";

/* ── Scroll reveal — 3D "settle into place" entrance used across the landing
   page for cards and panels. One shared spec so every section moves the same
   way (Apple/macOS Sonoma-style restraint, not a demo-reel bounce). ────────── */
const revealVariants: Variants = {
  hidden: { opacity: 0, y: 28, rotateX: -8 },
  visible: { opacity: 1, y: 0, rotateX: 0 },
};

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={cn("[transform-style:preserve-3d]", className)}
      style={{ perspective: 800 }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      variants={revealVariants}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

/* ── Glass card — the Apple/Sonoma-style floating surface used for feature,
   pricing, use-case and metric cards on the landing page. ─────────────────── */
export function GlassCard({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("glass-panel", className)} {...props}>
      {children}
    </div>
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

/* ── Hero product-preview: a live "Brief → AI generation → Proposal" loop.
   Three phases cycle automatically so the hero visual sells the actual
   differentiator (AI drafting from a brief) instead of a static mockup. ───── */
type BriefStep = "input" | "generating" | "output";
const STEP_MS: Record<BriefStep, number> = { input: 2400, generating: 2600, output: 3400 };

export function BriefToProposalPreview() {
  const { lang } = useLang();
  const [step, setStep] = useState<BriefStep>("input");

  useEffect(() => {
    const order: BriefStep[] = ["input", "generating", "output"];
    const t = setTimeout(() => {
      setStep((s) => order[(order.indexOf(s) + 1) % order.length]);
    }, STEP_MS[step]);
    return () => clearTimeout(t);
  }, [step]);

  const briefText =
    lang === "tr"
      ? "Acme Corp için 15.000$ bütçeli bir marka stratejisi ve web sitesi teklifi yaz"
      : "Write a brand strategy & web design proposal for Acme Corp with a $15k budget";

  const genRows =
    lang === "tr"
      ? ["Brief analiz ediliyor…", "Marka tonu eşleştiriliyor…", "Kapsam & fiyatlandırma yazılıyor…"]
      : ["Analyzing brief…", "Matching brand tone…", "Drafting scope & pricing…"];

  const items = [
    { name: lang === "tr" ? "Marka stratejisi" : "Brand strategy", amount: 5200 },
    { name: lang === "tr" ? "Web sitesi · 6 sayfa" : "Website · 6 pages", amount: 8300 },
    { name: lang === "tr" ? "Lansman kiti" : "Launch kit", amount: 1500 },
  ];
  const total = items.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="relative w-full">
      <div className="glow-rim rounded-[1.15rem]">
        <AppWindowFrame label={lang === "tr" ? "seelydeal.app · AI ile taslak" : "seelydeal.app · AI drafting"}>
          <div className="relative min-h-[280px] p-5">
            <AnimatePresence mode="wait">
              {step === "input" && (
                <motion.div
                  key="input"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-3"
                >
                  <p className="label-mono text-muted-foreground">{lang === "tr" ? "Brief" : "Brief"}</p>
                  <div className="rounded-xl border border-border bg-muted/40 p-4">
                    <div className="flex items-start gap-2.5">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <p className="text-[13.5px] leading-relaxed">{briefText}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <motion.span
                        className="block h-full rounded-full"
                        style={{ background: "var(--grad-brand)" }}
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 2, ease: "linear" }}
                      />
                    </span>
                    <span className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground">
                      {lang === "tr" ? "Oluştur" : "Generate"}
                    </span>
                  </div>
                </motion.div>
              )}

              {step === "generating" && (
                <motion.div
                  key="generating"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-2.5"
                >
                  <p className="label-mono text-primary">{lang === "tr" ? "AI çalışıyor" : "AI at work"}</p>
                  {genRows.map((row, i) => (
                    <motion.div
                      key={row}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.35, duration: 0.4 }}
                      className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 p-3"
                    >
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      </span>
                      <span className="flex-1 text-[13px]">{row}</span>
                      <span className="h-2 w-14 overflow-hidden rounded-full bg-muted shimmer" />
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {step === "output" && (
                <motion.div
                  key="output"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="relative overflow-hidden rounded-xl px-4 pb-3.5 pt-4" style={{ backgroundImage: "var(--grad-brand)" }}>
                    <span className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/15 blur-2xl" aria-hidden />
                    <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/70">
                      {lang === "tr" ? "Acme Corp için teklif" : "Proposal for Acme Corp"}
                    </p>
                    <p className="mt-1 font-display text-[17px] font-bold leading-tight text-white">
                      {lang === "tr" ? "Marka stratejisi & web sitesi" : "Brand strategy & website"}
                    </p>
                  </div>
                  <div className="mt-3 overflow-hidden rounded-xl border border-border">
                    {items.map((it, i) => (
                      <div key={it.name} className={cn("flex items-center justify-between px-3 py-2 text-[12.5px]", i < items.length - 1 && "border-b border-border/60")}>
                        <span className="truncate font-medium">{it.name}</span>
                        <span className="tnum font-semibold">{formatUsd(it.amount)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2.5 flex items-center justify-between rounded-xl bg-muted/50 px-3.5 py-2">
                    <span className="text-[12.5px] font-semibold">{lang === "tr" ? "Toplam" : "Total"}</span>
                    <span className="tnum text-base font-bold text-primary">{formatUsd(total)}</span>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2.5 rounded-xl border border-border bg-card p-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-success/12 text-success">
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11.5px] font-semibold leading-tight">{lang === "tr" ? "Hazır — imzaya gönderilebilir" : "Ready — send for signature"}</p>
                    </div>
                    <PenLine className="h-4 w-4 text-primary" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </AppWindowFrame>
      </div>

      {/* floating "opened" chip */}
      <div className="glass-panel absolute -bottom-3 left-5 hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold sm:inline-flex">
        <PenLine className="h-3 w-3 text-primary" />
        {lang === "tr" ? "tek tıkla imza" : "one-click sign"}
      </div>
    </div>
  );
}
