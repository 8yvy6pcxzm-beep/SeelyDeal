import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { PlanProvider } from "@/components/app/plan-provider";
import { AiDraftProvider } from "@/components/app/ai-draft-provider";

/**
 * Public, login-free showcase of the Custom plan — no Supabase call, no auth
 * wall. Plan is hardcoded to "custom" so every planAllows() gate in the reused
 * dashboard/analytics pages resolves open, with no "Pro"/locked badges (those
 * only render when a gate is closed). Only pages actually built for this shell
 * are listed in DEMO_ALLOWED_HREFS — everything else in the sidebar renders
 * as non-navigating so a prospect never lands on a broken, unauthenticated
 * real page.
 */
const DEMO_ALLOWED_HREFS = ["/dashboard", "/analytics", "/proposals", "/templates", "/clients", "/content", "/team", "/settings", "/signatures", "/integrations"];

export default function DemoLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <PlanProvider plan="custom" trialDaysLeft={null}>
      <AiDraftProvider>
        <div className="flex h-dvh overflow-hidden bg-background">
          <Sidebar userName="Demo" userEmail={null} basePath="/demo" allowedHrefs={DEMO_ALLOWED_HREFS} />
          <div className="relative flex flex-1 flex-col overflow-hidden">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-64"
              style={{ background: "var(--grad-cloud)" }}
              aria-hidden
            />
            <Topbar userName="Demo" userEmail={null} />
            <main className="relative z-10 flex-1 overflow-y-auto p-5 lg:p-8">{children}</main>
          </div>
        </div>
      </AiDraftProvider>
    </PlanProvider>
  );
}
