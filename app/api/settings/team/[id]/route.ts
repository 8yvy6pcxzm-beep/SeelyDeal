import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";
import { planAllows } from "@/lib/plan";

async function requireAdmin(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return { error: NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 }) } as const;

  const service = createServiceClient();
  const { data: me } = await service
    .from("profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!me) return { error: NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 }) } as const;

  const { data: company } = await service.from("companies").select("plan").eq("id", me.company_id).maybeSingle();
  if (!planAllows(company?.plan, "user_roles")) {
    return { error: NextResponse.json({ error: "Bu özellik Custom paketinde kullanılabilir." }, { status: 403 }) } as const;
  }
  if (me.role !== "owner" && me.role !== "admin") {
    return { error: NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 }) } as const;
  }

  return { service, companyId: me.company_id, userId: user.id } as const;
}

/** id is either a profiles.id (existing member) or a team_invites.id (pending seat) — tried in order. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { service, companyId, userId } = ctx;

  const { role, permissions } = (await req.json()) as {
    role?: "owner" | "admin" | "member" | "viewer";
    permissions?: Record<string, boolean>;
  };

  if (id === userId && role && role !== "owner") {
    return NextResponse.json({ error: "Kendi rolünü değiştiremezsin." }, { status: 400 });
  }

  const { data: member } = await service.from("profiles").select("id").eq("id", id).eq("company_id", companyId).maybeSingle();
  if (member) {
    const { error } = await service
      .from("profiles")
      .update({ ...(role ? { role } : {}), ...(permissions ? { permissions } : {}) })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { data: invite } = await service.from("team_invites").select("id").eq("id", id).eq("company_id", companyId).maybeSingle();
  if (invite) {
    const { error } = await service
      .from("team_invites")
      .update({ ...(role ? { role } : {}), ...(permissions ? { permissions } : {}) })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { service, companyId, userId } = ctx;

  if (id === userId) {
    return NextResponse.json({ error: "Kendini ekipten çıkaramazsın." }, { status: 400 });
  }

  const { data: member } = await service.from("profiles").select("id, role").eq("id", id).eq("company_id", companyId).maybeSingle();
  if (member) {
    if (member.role === "owner") return NextResponse.json({ error: "Sahibi kaldıramazsın." }, { status: 400 });
    const { error } = await service.from("profiles").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await service.from("team_invites").delete().eq("id", id).eq("company_id", companyId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
