"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import appConfig from "@/app.config";
import { Icon } from "@/components/ui/icon";
import { useLang } from "@/components/i18n/language-provider";
import { cn } from "@/lib/utils";
import { usePlan } from "@/components/app/plan-provider";
import { planAllows, type GatedFeature } from "@/lib/plan";

/** Which nav routes correspond to a plan-gated feature (not "coming soon" muted, but a real Pro+ page). */
const NAV_GATE: Record<string, GatedFeature> = {
  "/analytics": "analytics",
};

/** The grouped nav list — shared by the desktop Sidebar and the mobile drawer. */
export function NavGroups({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { t } = useLang();
  const plan = usePlan();

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-2">
      {appConfig.navGroups.map((group) => (
        <div key={t(group.label)} className="mb-4">
          <p className="label-mono px-3 pb-1.5 pt-2 text-sidebar-muted">{t(group.label)}</p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(item.href);
              const gate = NAV_GATE[item.href];
              const locked = gate ? !planAllows(plan, gate) : false;
              const inner = (
                <>
                  <Icon
                    name={item.icon}
                    className={cn("h-[17px] w-[17px] shrink-0", active ? "text-primary" : "text-muted-foreground")}
                  />
                  <span className="truncate">{t(item.label)}</span>
                  {item.badge && (
                    <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      {t(item.badge)}
                    </span>
                  )}
                  {locked && (
                    <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      Pro
                    </span>
                  )}
                </>
              );
              // Muted items are "coming soon" — render non-navigating.
              if (item.muted) {
                return (
                  <span
                    key={item.href}
                    className="group flex cursor-default items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium text-sidebar-muted"
                  >
                    {inner}
                  </span>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
                    locked
                      ? "text-sidebar-muted hover:bg-muted hover:text-foreground"
                      : active
                        ? "nav-pill-active text-foreground"
                        : "text-foreground/70 hover:bg-muted hover:text-foreground",
                  )}
                >
                  {inner}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
