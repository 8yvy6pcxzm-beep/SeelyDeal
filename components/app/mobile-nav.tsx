"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Sparkles, Settings, LifeBuoy, LogOut } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { useLang } from "@/components/i18n/language-provider";
import { cn } from "@/lib/utils";
import { useOpenAiDraft } from "@/components/app/ai-draft-provider";
import { NavGroups } from "@/components/app/nav-groups";
import appConfig from "@/app.config";

/** Hamburger button + slide-in drawer — the mobile equivalent of the desktop Sidebar. */
export function MobileNav({ userName, userEmail }: { userName: string | null; userEmail: string | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { lang } = useLang();
  const openAiDraft = useOpenAiDraft();

  const displayName = userName ?? userEmail?.split("@")[0] ?? (lang === "tr" ? "Kullanıcı" : "User");
  const initials = displayName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      <button
        aria-label={lang === "tr" ? "Menüyü aç" : "Open menu"}
        onClick={() => setOpen(true)}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden />
          <aside className="animate-float-up absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground shadow-pop">
            <div className="flex h-16 items-center justify-between px-5">
              <Link href="/dashboard" className="inline-flex" onClick={() => setOpen(false)}>
                <Logo withChevron />
              </Link>
              <button
                aria-label={lang === "tr" ? "Menüyü kapat" : "Close menu"}
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="px-3 pb-2">
              <button
                onClick={() => {
                  setOpen(false);
                  openAiDraft();
                }}
                className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <Sparkles className="h-4 w-4 text-primary" />
                <span>{lang === "tr" ? "AI ile teklif yaz" : "Draft with AI"}</span>
              </button>
            </div>

            <NavGroups onNavigate={() => setOpen(false)} />

            <div className="space-y-0.5 px-3 pb-2">
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
                  isActive("/settings") ? "nav-pill-active text-foreground" : "text-foreground/70 hover:bg-muted hover:text-foreground",
                )}
              >
                <Settings className="h-[17px] w-[17px] text-muted-foreground" />
                {lang === "tr" ? "Ayarlar" : "Settings"}
              </Link>
              <a
                href={`mailto:${appConfig.contactEmail}`}
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
              >
                <LifeBuoy className="h-[17px] w-[17px] text-muted-foreground" />
                {lang === "tr" ? "Destek" : "Support"}
              </a>
            </div>

            <div className="border-t border-sidebar-border p-3">
              <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-2.5 py-2 shadow-pill">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundImage: "var(--grad-brand)" }}
                >
                  {initials}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold capitalize">{displayName}</p>
                  <p className="truncate text-[11.5px] text-muted-foreground">{userEmail ?? ""}</p>
                </div>
                <Link
                  href="/login"
                  aria-label={lang === "tr" ? "Çıkış" : "Log out"}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
