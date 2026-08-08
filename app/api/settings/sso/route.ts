import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";
import { planAllows } from "@/lib/plan";

async function requireAdmin(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return { error: NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 }) } as const;

  const service = createServiceClient();
  const { data: me } = await service.from("profiles").select("company_id, role").eq("id", user.id).maybeSingle();
  if (!me) return { error: NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 }) } as const;

  const { data: company } = await service
    .from("companies")
    .select("plan, sso_enabled, sso_provider, sso_domain, sso_metadata_url, sso_configured_at")
    .eq("id", me.company_id)
    .maybeSingle();
  if (!planAllows(company?.plan, "sso")) {
    return { error: NextResponse.json({ error: "Bu özellik Custom paketinde kullanılabilir." }, { status: 403 }) } as const;
  }
  if (me.role !== "owner" && me.role !== "admin") {
    return { error: NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 }) } as const;
  }

  return { service, companyId: me.company_id, company } as const;
}

export async function GET(req: Request) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { company } = ctx;

  return NextResponse.json({ config: company });
}

export async function POST(req: Request) {
  const ctx = await requireAdmin(req);
  if ("error" in ctx) return ctx.error;
  const { service, companyId } = ctx;

  const { provider, domain, metadataUrl, enabled } = (await req.json()) as {
    provider?: "okta" | "azure_ad" | "salesforce";
    domain?: string;
    metadataUrl?: string;
    enabled?: boolean;
  };

  if (enabled && (!provider || !domain?.trim() || !metadataUrl?.trim())) {
    return NextResponse.json({ error: "Sağlayıcı, domain ve metadata URL gerekli." }, { status: 400 });
  }

  const { error } = await service
    .from("companies")
    .update({
      sso_provider: provider ?? null,
      sso_domain: domain?.trim() || null,
      sso_metadata_url: metadataUrl?.trim() || null,
      sso_enabled: !!enabled,
      sso_configured_at: enabled ? new Date().toISOString() : null,
    })
    .eq("id", companyId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
