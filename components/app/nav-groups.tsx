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
  "/content": "document_library",
};

/**
 * The grouped nav list — shared by the desktop Sidebar and the mobile drawer.
 *
 * `basePath` / `allowedHrefs` exist for the public demo shell (`/demo`), which
 * only has real routes for a subset of pages: links prefix with `basePath`,
 * and anything not in `allowedHrefs` renders as non-navigating ("coming soon"
 * in this shell) instead of 404ing.
 */
export function NavGroups({
  onNavigate,
  basePath = "",
  allowedHrefs,
}: {
  onNavigate?: () => void;
  basePath?: string;
  allowedHrefs?: string[];
}) {
  const pathname = usePathname();
  const { t } = useLang();
  const plan = usePlan();

  const isActive = (href: string) => pathname === basePath + href || pathname.startsWith(basePath + href + "/");

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-2">
      {appConfig.navGroups.map((group) => (
        <div key={t(group.label)} className="mb-4">
          <p className="label-mono px-3 pb-1.5 pt-2 text-sidebar-muted">{t(group.label)}</p>
          <div className="space-y-0.5">
            {group.items
              .filter((item) => !(item.hideForLite && plan === "lite"))
              .map((item) => {
              const active = isActive(item.href);
              const gate = NAV_GATE[item.href];
              const locked = gate ? !planAllows(plan, gate) : false;
              const demoDisabled = !!allowedHrefs && !allowedHrefs.includes(item.href);
              const inner = (
                <>
                  <Icon
                    name={item.icon}
                    className={cn("h-[17px] w-[17px] shrink-0", active ? "text-primary" : "text-muted-foreground")}
                  />
                  <span className="truncate">{t(item.label)}</span>
                  {item.badge && (
                    <span
                      className={cn(
                        "ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                        t(item.badge) === "Pro" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
                      )}
                    >
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
              if (item.muted || demoDisabled) {
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
                  href={basePath + item.href}
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
