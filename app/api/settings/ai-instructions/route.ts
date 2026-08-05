import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";

/** Appends a new standing instruction — captured mid-chat by the AI draft dialog (see the
 * TALİMAT KAYDI rule in app/api/draft-proposal/route.ts) — to companies.ai_instructions,
 * so it applies to every future proposal draft without the user repeating it. */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const { instruction } = (await req.json()) as { instruction?: string };
  if (!instruction?.trim()) return NextResponse.json({ error: "Talimat boş olamaz." }, { status: 400 });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 });

  const { data: company } = await service.from("companies").select("ai_instructions").eq("id", profile.company_id).maybeSingle();
  const existing = company?.ai_instructions?.trim();
  const merged = existing ? `${existing}\n- ${instruction.trim()}` : `- ${instruction.trim()}`;

  const { error } = await service.from("companies").update({ ai_instructions: merged }).eq("id", profile.company_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, ai_instructions: merged });
}
