import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";
import { isProposalFontKey } from "@/lib/proposal-fonts";

/** Saves companies.font — the company-level default display font (see
 * lib/proposal-fonts.ts for the curated "default"/"bold"/"elegant" set), applied
 * to new proposal drafts that don't come from a themed template (see the
 * fallback in app/api/draft-proposal/route.ts). Same shape as /api/settings/brand-color. */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const { font } = (await req.json()) as { font?: string };
  if (!isProposalFontKey(font)) return NextResponse.json({ error: "Geçersiz font." }, { status: 400 });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 });

  const { error } = await service.from("companies").update({ font }).eq("id", profile.company_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
