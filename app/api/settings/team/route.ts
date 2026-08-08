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

export async function GET(req: Request) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { service, companyId } = ctx;

  const [{ data: members, error: membersError }, { data: invites, error: invitesError }] = await Promise.all([
    service
      .from("profiles")
      .select("id, email, role, permissions, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true }),
    service
      .from("team_invites")
      .select("id, email, role, permissions, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true }),
  ]);

  if (membersError) return NextResponse.json({ error: membersError.message }, { status: 500 });
  if (invitesError) return NextResponse.json({ error: invitesError.message }, { status: 500 });

  return NextResponse.json({ members: members ?? [], invites: invites ?? [] });
}

export async function POST(req: Request) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { service, companyId, userId } = ctx;

  const { email, role, permissions } = (await req.json()) as {
    email?: string;
    role?: "admin" | "member" | "viewer";
    permissions?: Record<string, boolean>;
  };
  if (!email?.trim()) return NextResponse.json({ error: "E-posta gerekli." }, { status: 400 });

  const { data: existingMember } = await service
    .from("profiles")
    .select("id")
    .eq("company_id", companyId)
    .eq("email", email.trim())
    .maybeSingle();
  if (existingMember) return NextResponse.json({ error: "Bu kişi zaten ekipte." }, { status: 400 });

  const { error } = await service.from("team_invites").upsert(
    {
      company_id: companyId,
      email: email.trim(),
      role: role ?? "member",
      permissions: permissions ?? {},
      invited_by: userId,
    },
    { onConflict: "company_id,email" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
