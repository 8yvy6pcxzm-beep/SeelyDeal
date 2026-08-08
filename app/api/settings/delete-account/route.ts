import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";

/**
 * KVKK m.7/m.11 — the right to erasure. Only the company owner can trigger this
 * (it removes the whole company, not just one seat — see /api/settings/team for
 * removing a single teammate instead). Deleting the company row cascades to
 * every table with `on delete cascade` (proposals, clients, documents,
 * templates, team_invites, ai_usage, and every profile including this one).
 */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id, role").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 });

  if (profile.role !== "owner") {
    return NextResponse.json({ error: "Sadece şirket sahibi hesabı silebilir." }, { status: 403 });
  }

  const { error: deleteCompanyError } = await service.from("companies").delete().eq("id", profile.company_id);
  if (deleteCompanyError) return NextResponse.json({ error: deleteCompanyError.message }, { status: 500 });

  const { error: deleteUserError } = await service.auth.admin.deleteUser(user.id);
  if (deleteUserError) return NextResponse.json({ error: deleteUserError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
