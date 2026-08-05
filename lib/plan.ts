export type Plan = "lite" | "pro" | "custom";

/**
 * Features that exist in code but must stay OFF the free-trial (Lite) plan.
 * Lite gets only what's built into the base app: AI proposal drafting (brief-only,
 * see app/api/draft-proposal/route.ts's isLite branch), simple e-signature, and view tracking.
 */
export type GatedFeature = "crm_integrations" | "api_access" | "document_library" | "document_analytics" | "analytics" | "reminders" | "advanced_reporting";

const GATED_FEATURE_MIN_PLAN: Record<GatedFeature, Plan> = {
  crm_integrations: "pro",
  api_access: "pro",
  document_library: "pro",
  document_analytics: "pro",
  analytics: "pro",
  reminders: "pro",
  advanced_reporting: "custom",
};

const PLAN_RANK: Record<Plan, number> = { lite: 0, pro: 1, custom: 2 };

export function planAllows(plan: Plan | null | undefined, feature: GatedFeature): boolean {
  const current = plan ?? "lite";
  return PLAN_RANK[current] >= PLAN_RANK[GATED_FEATURE_MIN_PLAN[feature]];
}
