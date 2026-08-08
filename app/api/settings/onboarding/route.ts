import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";

/** Whether this company still needs Seely's first-chat intro (İLK TANIŞMA AKIŞI) —
 * the AI draft dialog checks this on open to decide whether to auto-kick it off. */
export async function GET(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 });

  const { data: company } = await service.from("companies").select("onboarding_completed").eq("id", profile.company_id).maybeSingle();
  return NextResponse.json({ onboardingCompleted: company?.onboarding_completed ?? true });
}

/** Marks the company's first-chat intro flow (Seely's İLK TANIŞMA AKIŞI, see
 * app/api/draft-proposal/route.ts) as done, so it never shows again. */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 });

  const { error } = await service.from("companies").update({ onboarding_completed: true }).eq("id", profile.company_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
