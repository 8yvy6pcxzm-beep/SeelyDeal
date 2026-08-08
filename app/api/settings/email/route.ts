import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";

/** Saves companies.email — used by the AI draft chat's onboarding "brand" block (see
 * app/api/draft-proposal/route.ts, İLK TANIŞMA AKIŞI) once the user confirms a contact
 * email extracted from a shared document. */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const { email } = (await req.json()) as { email?: string };
  if (!email?.trim()) return NextResponse.json({ error: "E-posta boş olamaz." }, { status: 400 });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 });

  const { error } = await service.from("companies").update({ email: email.trim() }).eq("id", profile.company_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
