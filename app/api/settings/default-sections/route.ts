import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";

/** Saves companies.default_sections — which of the 8 standard proposal sections
 * (see SECTION_OPTIONS in components/app/ai-draft-dialog.tsx) are included by
 * default in every new draft. Set once during onboarding (see the İLK TANIŞMA
 * AKIŞI rule in app/api/draft-proposal/route.ts), editable later from chat. */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const { sections } = (await req.json()) as { sections?: Record<string, boolean> };
  if (!sections || typeof sections !== "object") {
    return NextResponse.json({ error: "Geçersiz bölüm listesi." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 });

  const { error } = await service.from("companies").update({ default_sections: sections }).eq("id", profile.company_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
