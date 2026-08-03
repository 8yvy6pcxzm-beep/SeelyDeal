"use client";

import { createContext, useContext } from "react";
import type { Plan } from "@/lib/plan";

type PlanCtx = { plan: Plan; trialDaysLeft: number | null };

const PlanContext = createContext<PlanCtx | null>(null);

export function PlanProvider({
  plan,
  trialDaysLeft,
  children,
}: {
  plan: Plan;
  trialDaysLeft: number | null;
  children: React.ReactNode;
}) {
  return <PlanContext.Provider value={{ plan, trialDaysLeft }}>{children}</PlanContext.Provider>;
}

/** The current user's company plan, fetched once in app/(app)/layout.tsx. */
export function usePlan(): Plan {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used inside <PlanProvider>");
  return ctx.plan;
}

/** Days left in the Lite free trial, or null when the plan isn't trial-limited (Pro/Custom). */
export function useTrialDaysLeft(): number | null {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("useTrialDaysLeft must be used inside <PlanProvider>");
  return ctx.trialDaysLeft;
}
