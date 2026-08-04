import { NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";

export function hashApiKey(key: string) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export type ApiKeyAuthResult =
  | { ok: true; companyId: string }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "quota_exceeded"; limit: number };

/** Resolves the calling company from a `Authorization: Bearer sk_live_...` API key, enforcing the monthly call limit and logging usage. */
export async function authenticateApiKey(req: Request): Promise<ApiKeyAuthResult> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return { ok: false, reason: "invalid" };

  const apiKey = authHeader.slice(7);
  if (!apiKey) return { ok: false, reason: "invalid" };

  const service = createServiceClient();
  const { data: company } = await service
    .from("companies")
    .select("id, api_monthly_limit")
    .eq("api_key_hash", hashApiKey(apiKey))
    .maybeSingle();
  if (!company) return { ok: false, reason: "invalid" };

  const limit: number = company.api_monthly_limit ?? 500;
  const month = new Date().toISOString().slice(0, 7);
  const { data: usage } = await service.from("api_usage").select("count").eq("company_id", company.id).eq("month", month).maybeSingle();
  const used = usage?.count ?? 0;
  if (used >= limit) return { ok: false, reason: "quota_exceeded", limit };

  await service.from("api_usage").upsert({ company_id: company.id, month, count: used + 1 }, { onConflict: "company_id,month" });

  return { ok: true, companyId: company.id as string };
}

export function apiAuthError(auth: Extract<ApiKeyAuthResult, { ok: false }>) {
  if (auth.reason === "quota_exceeded") {
    return NextResponse.json({ error: `Bu ayki API çağrı hakkın (${auth.limit}) doldu.` }, { status: 429 });
  }
  return NextResponse.json({ error: "Geçersiz veya eksik API anahtarı." }, { status: 401 });
}
