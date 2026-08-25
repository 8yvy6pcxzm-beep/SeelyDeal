"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Settings, LifeBuoy, LogOut } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { useLang } from "@/components/i18n/language-provider";
import { cn } from "@/lib/utils";
import { NavGroups } from "@/components/app/nav-groups";
import appConfig from "@/app.config";

export function Sidebar({
  userName,
  userEmail,
  basePath = "",
  allowedHrefs,
  aiUsed,
  aiLimit,
}: {
  userName: string | null;
  userEmail: string | null;
  basePath?: string;
  allowedHrefs?: string[];
  aiUsed?: number | null;
  aiLimit?: number | null;
}) {
  const pathname = usePathname();
  const { lang } = useLang();

  const displayName = userName ?? userEmail?.split("@")[0] ?? (lang === "tr" ? "Kullanıcı" : "User");
  const initials = displayName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const isActive = (href: string) =>
    pathname === basePath + href || pathname.startsWith(basePath + href + "/");
  const settingsAllowed = !allowedHrefs || allowedHrefs.includes("/settings");

  return (
    <aside className="hidden w-[260px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar/95 text-sidebar-foreground backdrop-blur-sm md:flex">
      {/* Brand */}
      <div className="flex h-16 items-center px-5">
        <Link href={basePath + "/dashboard"} className="inline-flex">
          <Logo withChevron />
        </Link>
      </div>

      {/* Grouped nav */}
      <NavGroups basePath={basePath} allowedHrefs={allowedHrefs} />

      {/* Settings + Support */}
      <div className="space-y-0.5 px-3 pb-2">
        {settingsAllowed ? (
          <Link
            href={basePath + "/settings"}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
              isActive("/settings") ? "nav-pill-active text-foreground" : "text-foreground/70 hover:bg-muted hover:text-foreground",
            )}
          >
            <Settings className="h-[17px] w-[17px] text-muted-foreground" />
            {lang === "tr" ? "Ayarlar" : "Settings"}
          </Link>
        ) : (
          <span className="flex cursor-default items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium text-sidebar-muted">
            <Settings className="h-[17px] w-[17px] text-muted-foreground" />
            {lang === "tr" ? "Ayarlar" : "Settings"}
          </span>
        )}
        <a
          href={`mailto:${appConfig.contactEmail}`}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
        >
          <LifeBuoy className="h-[17px] w-[17px] text-muted-foreground" />
          {lang === "tr" ? "Destek" : "Support"}
        </a>
      </div>

      {/* AI credit meter */}
      {aiLimit != null && (
        <div className="px-3 pt-2">
          <Link
            href={basePath + "/settings"}
            className="block rounded-lg border border-border bg-card px-3 py-2 transition-colors hover:border-primary/30"
          >
            <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="flex-1">{lang === "tr" ? "AI kredisi" : "AI credit"}</span>
              <span className="font-semibold tabular-nums text-foreground">
                {Math.min(aiUsed ?? 0, aiLimit)} / {aiLimit}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
              <div
                className={cn("h-full rounded-full", (aiUsed ?? 0) >= aiLimit * 0.8 && "bg-warning")}
                style={
                  (aiUsed ?? 0) >= aiLimit * 0.8
                    ? { width: `${Math.min(100, ((aiUsed ?? 0) / aiLimit) * 100)}%` }
                    : { width: `${Math.min(100, ((aiUsed ?? 0) / aiLimit) * 100)}%`, backgroundImage: "var(--grad-brand)" }
                }
              />
            </div>
          </Link>
        </div>
      )}

      {/* Pinned user card */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-2.5 py-2 shadow-pill">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white" style={{ backgroundImage: "var(--grad-brand)" }}>
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
  );
}
