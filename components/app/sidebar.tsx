"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Settings, LifeBuoy, LogOut } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { useLang } from "@/components/i18n/language-provider";
import { cn } from "@/lib/utils";
import { useOpenAiDraft } from "@/components/app/ai-draft-provider";
import { NavGroups } from "@/components/app/nav-groups";
import appConfig from "@/app.config";

export function Sidebar({
  userName,
  userEmail,
  basePath = "",
  allowedHrefs,
}: {
  userName: string | null;
  userEmail: string | null;
  basePath?: string;
  allowedHrefs?: string[];
}) {
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

  const isActive = (href: string) =>
    pathname === basePath + href || pathname.startsWith(basePath + href + "/");
  const settingsAllowed = !allowedHrefs || allowedHrefs.includes("/settings");

  return (
    <aside className="hidden w-[260px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      {/* Brand */}
      <div className="flex h-16 items-center px-5">
        <Link href={basePath + "/dashboard"} className="inline-flex">
          <Logo withChevron />
        </Link>
      </div>

      {/* AI draft pill */}
      <div className="px-3 pb-2">
        <button
          onClick={openAiDraft}
          className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <Sparkles className="h-4 w-4 text-primary" />
          <span>{lang === "tr" ? "AI ile teklif yaz" : "Draft with AI"}</span>
          <kbd className="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
        </button>
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
