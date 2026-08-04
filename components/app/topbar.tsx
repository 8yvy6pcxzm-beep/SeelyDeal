"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Bell, Plus, Clock } from "lucide-react";
import appConfig from "@/app.config";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { useLang } from "@/components/i18n/language-provider";
import { useTrialDaysLeft } from "@/components/app/plan-provider";
import { useOpenAiDraft } from "@/components/app/ai-draft-provider";
import { MobileNav } from "@/components/app/mobile-nav";
import { cn } from "@/lib/utils";

export function Topbar({ userName, userEmail }: { userName: string | null; userEmail: string | null }) {
  const pathname = usePathname();
  const { t, lang } = useLang();
  const trialDaysLeft = useTrialDaysLeft();
  const openAiDraft = useOpenAiDraft();
  const [notifOpen, setNotifOpen] = useState(false);
  const current =
    appConfig.nav.find((n) => pathname === n.href || pathname.startsWith(n.href + "/")) ??
    appConfig.navGroups.flatMap((g) => g.items).find((n) => pathname === n.href || pathname.startsWith(n.href + "/"));

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-border bg-background/80 px-5 backdrop-blur lg:px-8">
      <MobileNav userName={userName} userEmail={userEmail} />
      <span className="font-display text-[15px] font-semibold tracking-tight md:hidden">
        {current ? t(current.label) : appConfig.name}
      </span>

      {trialDaysLeft !== null && (
        <Link
          href="/#pricing"
          className={cn(
            "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors sm:inline-flex",
            trialDaysLeft <= 3
              ? "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15"
              : "border-primary/25 bg-primary/[0.06] text-primary hover:bg-primary/10",
          )}
        >
          <Clock className="h-3.5 w-3.5" />
          {lang === "tr" ? `Denemede ${trialDaysLeft} gün kaldı` : `${trialDaysLeft} days left in trial`}
        </Link>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        <button
          onClick={openAiDraft}
          className="hidden h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 sm:inline-flex"
        >
          <Plus className="h-4 w-4" />
          {lang === "tr" ? "Yeni teklif" : "New proposal"}
        </button>
        <LanguageToggle className="mr-1" />
        <div className="relative">
          <button
            aria-label="Notifications"
            onClick={() => setNotifOpen((v) => !v)}
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Bell className="h-[18px] w-[18px]" />
          </button>
          {notifOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 top-11 z-20 w-64 rounded-xl border border-border bg-card p-4 text-center shadow-pop">
                <Bell className="mx-auto h-5 w-5 text-muted-foreground" />
                <p className="mt-2 text-[13px] font-medium">
                  {lang === "tr" ? "Bildirimler yakında geliyor" : "Notifications are coming soon"}
                </p>
                <p className="mt-1 text-[11.5px] text-muted-foreground">
                  {lang === "tr"
                    ? "Teklif görüntülendiğinde/imzalandığında burada anlık uyarı alacaksın."
                    : "You'll get a live alert here when a proposal is viewed or signed."}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
