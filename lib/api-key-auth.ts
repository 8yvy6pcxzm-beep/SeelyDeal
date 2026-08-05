import { NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";

export function hashApiKey(key: string) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/** Default monthly call quota by plan when a company hasn't been given a custom override — Custom's "advanced API support" includes a 4x higher ceiling than Pro. */
const DEFAULT_MONTHLY_LIMIT: Record<string, number> = { pro: 500, custom: 2000 };

export type ApiKeyAuthResult =
  | { ok: true; companyId: string; plan: string }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "quota_exceeded"; limit: number }
  | { ok: false; reason: "plan_required"; minPlan: string };

/** Resolves the calling company from a `Authorization: Bearer sk_live_...` API key, enforcing the monthly call limit and logging usage. */
export async function authenticateApiKey(req: Request): Promise<ApiKeyAuthResult> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return { ok: false, reason: "invalid" };

  const apiKey = authHeader.slice(7);
  if (!apiKey) return { ok: false, reason: "invalid" };

  const service = createServiceClient();
  const { data: company } = await service
    .from("companies")
    .select("id, plan, api_monthly_limit")
    .eq("api_key_hash", hashApiKey(apiKey))
    .maybeSingle();
  if (!company) return { ok: false, reason: "invalid" };

  const plan: string = company.plan ?? "pro";
  const limit: number = company.api_monthly_limit ?? DEFAULT_MONTHLY_LIMIT[plan] ?? 500;
  const month = new Date().toISOString().slice(0, 7);
  const { data: usage } = await service.from("api_usage").select("count").eq("company_id", company.id).eq("month", month).maybeSingle();
  const used = usage?.count ?? 0;
  if (used >= limit) return { ok: false, reason: "quota_exceeded", limit };

  await service.from("api_usage").upsert({ company_id: company.id, month, count: used + 1 }, { onConflict: "company_id,month" });

  return { ok: true, companyId: company.id as string, plan };
}

export function apiAuthError(auth: Extract<ApiKeyAuthResult, { ok: false }>) {
  if (auth.reason === "quota_exceeded") {
    return NextResponse.json({ error: `Bu ayki API çağrı hakkın (${auth.limit}) doldu.` }, { status: 429 });
  }
  if (auth.reason === "plan_required") {
    return NextResponse.json({ error: `Bu uç nokta ${auth.minPlan} pakette kullanılabilir.` }, { status: 403 });
  }
  return NextResponse.json({ error: "Geçersiz veya eksik API anahtarı." }, { status: 401 });
}
