import { redirect } from "next/navigation";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { PlanProvider } from "@/components/app/plan-provider";
import { AiDraftProvider } from "@/components/app/ai-draft-provider";
import { TrialExpiredScreen } from "@/components/app/trial-expired-screen";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Plan } from "@/lib/plan";
import { trialDaysLeft, isTrialExpired } from "@/lib/trial";

async function getCurrentUser(): Promise<{
  plan: Plan;
  name: string | null;
  email: string | null;
  trialDaysLeft: number | null;
  trialExpired: boolean;
  onboardingPending: boolean;
}> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user)
    return { plan: "lite", name: null, email: null, trialDaysLeft: null, trialExpired: false, onboardingPending: false };

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", auth.user.id).maybeSingle();
  if (!profile)
    return { plan: "lite", name: null, email: auth.user.email ?? null, trialDaysLeft: null, trialExpired: false, onboardingPending: false };

  const [{ data: company }, { data: teamMember }] = await Promise.all([
    service.from("companies").select("plan, created_at, onboarding_completed").eq("id", profile.company_id).maybeSingle(),
    service.from("team_members").select("name").eq("company_id", profile.company_id).eq("email", auth.user.email).maybeSingle(),
  ]);

  const plan = (company?.plan as Plan) ?? "lite";
  // Only Lite is trial-limited (see lib/plan.ts) — Pro/Custom are paid, no countdown.
  const onTrial = plan === "lite" && !!company?.created_at;

  return {
    plan,
    name: teamMember?.name ?? null,
    email: auth.user.email ?? null,
    trialDaysLeft: onTrial ? trialDaysLeft(company!.created_at) : null,
    trialExpired: onTrial ? isTrialExpired(company!.created_at) : false,
    // Every plan (Lite/Pro/Custom) goes through the same form-based onboarding
    // wizard at /onboarding before it can see the dashboard.
    onboardingPending: company?.onboarding_completed === false,
  };
}

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { plan, name, email, trialDaysLeft: daysLeft, trialExpired, onboardingPending } = await getCurrentUser();

  if (onboardingPending) {
    redirect("/onboarding");
  }

  if (trialExpired) {
    return <TrialExpiredScreen />;
  }

  return (
    <PlanProvider plan={plan} trialDaysLeft={daysLeft}>
      <AiDraftProvider>
        <div className="flex h-dvh overflow-hidden bg-background">
          <Sidebar userName={name} userEmail={email} />
          <div className="relative flex flex-1 flex-col overflow-hidden">
            {/* faint aurora wash at the very top of the app */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-64"
              style={{ background: "var(--grad-cloud)" }}
              aria-hidden
            />
            <Topbar userName={name} userEmail={email} />
            <main className="relative z-10 flex-1 overflow-y-auto p-5 lg:p-8">{children}</main>
          </div>
        </div>
      </AiDraftProvider>
    </PlanProvider>
  );
}
