"use client";

import Link from "next/link";
import { Clock } from "lucide-react";
import appConfig from "@/app.config";
import { useLang } from "@/components/i18n/language-provider";
import { TRIAL_DAYS } from "@/lib/trial";

/** Full-screen takeover once a Lite (free-trial) company passes TRIAL_DAYS since signup. */
export function TrialExpiredScreen() {
  const { lang } = useLang();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="glass-card w-full max-w-md p-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
          <Clock className="h-6 w-6" />
        </span>
        <h1 className="mt-4 font-display text-xl font-bold tracking-tight">
          {lang === "tr" ? "14 günlük deneme süren sona erdi" : "Your 14-day trial has ended"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {lang === "tr"
            ? `${appConfig.name}'i kullanmaya devam etmek için bir pakete geç. Verilerin güvende — yükseltir yükseltmez kaldığın yerden devam edersin.`
            : `Upgrade to keep using ${appConfig.name}. Your data is safe — you'll pick up right where you left off.`}
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          <Link
            href="/#pricing"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-primary text-[14px] font-semibold text-primary-foreground shadow-glow transition-opacity hover:opacity-90"
          >
            {lang === "tr" ? "Paketleri gör" : "See plans"}
          </Link>
          <a
            href={`mailto:${appConfig.contactEmail}`}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-border text-[14px] font-semibold text-foreground transition-colors hover:bg-muted"
          >
            {lang === "tr" ? "Bize ulaş" : "Contact us"}
          </a>
        </div>
        <p className="mt-5 text-[11px] text-muted-foreground">
          {lang === "tr" ? `Deneme süresi ${TRIAL_DAYS} gündür.` : `The trial period is ${TRIAL_DAYS} days.`}
        </p>
      </div>
    </div>
  );
}
