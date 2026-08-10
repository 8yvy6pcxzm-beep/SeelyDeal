import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";

/** Saves companies.address / companies.phone — used by the AI draft chat's onboarding
 * "brand" block (see app/api/draft-proposal/route.ts, İLK TANIŞMA AKIŞI) once the user
 * confirms letterhead-style contact details (extracted from a shared document, or typed). */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const { address, phone } = (await req.json()) as { address?: string; phone?: string };
  if (!address?.trim() && !phone?.trim()) {
    return NextResponse.json({ error: "Adres veya telefon boş olamaz." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 });

  const patch: { address?: string; phone?: string } = {};
  if (address?.trim()) patch.address = address.trim();
  if (phone?.trim()) patch.phone = phone.trim();

  const { error } = await service.from("companies").update(patch).eq("id", profile.company_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
