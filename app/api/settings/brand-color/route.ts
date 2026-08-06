import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Saves companies.primary_color — used by the AI draft chat's "brand" block (see app/api/draft-proposal/route.ts) so a hex code typed or read off a logo image applies without a trip to Company Profile. */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const { primaryColor } = (await req.json()) as { primaryColor?: string };
  if (!primaryColor || !HEX_RE.test(primaryColor)) {
    return NextResponse.json({ error: "Geçersiz renk kodu." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 });

  const { error } = await service.from("companies").update({ primary_color: primaryColor }).eq("id", profile.company_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
