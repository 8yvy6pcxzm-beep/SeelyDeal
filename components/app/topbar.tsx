"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Bell, Clock, Eye, PenLine } from "lucide-react";
import appConfig from "@/app.config";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { useLang } from "@/components/i18n/language-provider";
import { useTrialDaysLeft } from "@/components/app/plan-provider";
import { MobileNav } from "@/components/app/mobile-nav";
import { cn, formatRelative } from "@/lib/utils";
import type { NotificationItem } from "@/app/api/notifications/route";

const LAST_SEEN_KEY = "notifications-last-seen";

export function Topbar({ userName, userEmail }: { userName: string | null; userEmail: string | null }) {
  const pathname = usePathname();
  const { t, lang } = useLang();
  const trialDaysLeft = useTrialDaysLeft();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [lastSeen, setLastSeen] = useState(0);

  useEffect(() => {
    setLastSeen(Number(localStorage.getItem(LAST_SEEN_KEY) ?? 0));
    async function load() {
      try {
        const res = await fetch("/api/notifications");
        const data = await res.json();
        setNotifications(data.notifications ?? []);
      } catch {
        setNotifications([]);
      }
    }
    load();
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter((n) => new Date(n.at).getTime() > lastSeen).length;

  function toggleNotif() {
    setNotifOpen((v) => {
      const next = !v;
      if (next) {
        const now = Date.now();
        localStorage.setItem(LAST_SEEN_KEY, String(now));
        setLastSeen(now);
      }
      return next;
    });
  }

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
        <LanguageToggle className="mr-1" />
        <div className="relative">
          <button
            aria-label="Notifications"
            onClick={toggleNotif}
            className="relative grid h-9 w-9 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
            )}
          </button>
          {notifOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
              <div className="glass-card absolute right-0 top-11 z-20 w-80">
                <div className="border-b border-border px-4 py-3 text-[13px] font-semibold">
                  {lang === "tr" ? "Bildirimler" : "Notifications"}
                </div>
                {notifications.length === 0 ? (
                  <div className="p-4 text-center">
                    <Bell className="mx-auto h-5 w-5 text-muted-foreground" />
                    <p className="mt-2 text-[13px] font-medium">
                      {lang === "tr" ? "Henüz bildirim yok" : "No notifications yet"}
                    </p>
                    <p className="mt-1 text-[11.5px] text-muted-foreground">
                      {lang === "tr"
                        ? "Teklif görüntülendiğinde/imzalandığında burada anlık uyarı alacaksın."
                        : "You'll get a live alert here when a proposal is viewed or signed."}
                    </p>
                  </div>
                ) : (
                  <ul className="max-h-96 overflow-y-auto py-1">
                    {notifications.map((n) => (
                      <li key={n.id}>
                        <Link
                          href="/proposals"
                          onClick={() => setNotifOpen(false)}
                          className="flex items-start gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-muted"
                        >
                          <span
                            className={cn(
                              "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full",
                              n.type === "signed" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                            )}
                          >
                            {n.type === "signed" ? <PenLine className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium">
                              {n.type === "signed"
                                ? lang === "tr"
                                  ? `${n.client || n.title} teklifi imzaladı`
                                  : `${n.client || n.title} signed the proposal`
                                : lang === "tr"
                                  ? `${n.client || n.title} teklifi görüntüledi`
                                  : `${n.client || n.title} viewed the proposal`}
                            </span>
                            <span className="block truncate text-[11.5px] text-muted-foreground">{n.title}</span>
                          </span>
                          <span className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">
                            {formatRelative(n.at, lang)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
