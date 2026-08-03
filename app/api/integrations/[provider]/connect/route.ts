import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";
import { getCrmProvider } from "@/lib/integrations/crm-providers";
import { planAllows } from "@/lib/plan";

/** Starts the OAuth2 authorization-code flow for a registered CRM provider. */
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const config = getCrmProvider(provider);
  if (!config) return NextResponse.json({ error: `Bilinmeyen CRM sağlayıcısı: ${provider}` }, { status: 404 });

  const clientId = process.env[config.clientIdEnv];
  if (!clientId) {
    return NextResponse.json(
      { error: `${config.name} entegrasyonu henüz yapılandırılmadı (${config.clientIdEnv} eksik).` },
      { status: 501 },
    );
  }

  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Bu özellik için giriş yapmalısın." }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 });

  const { data: company } = await service.from("companies").select("plan").eq("id", profile.company_id).maybeSingle();
  if (!planAllows(company?.plan, "crm_integrations")) {
    return NextResponse.json({ error: "CRM entegrasyonları Pro ve Custom paketlerinde kullanılabilir." }, { status: 403 });
  }

  // Unguessable nonce, bound to this browser via an HttpOnly cookie — the callback
  // must see the same value in both places before it trusts the request at all.
  const nonce = randomBytes(32).toString("hex");
  const origin = new URL(req.url).origin;

  const authorizeUrl = new URL(config.authorizeUrl);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", `${origin}/api/integrations/${provider}/callback`);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", config.scopes.join(" "));
  authorizeUrl.searchParams.set("state", nonce);

  const response = NextResponse.redirect(authorizeUrl.toString());
  response.cookies.set(`oauth_state_${provider}`, nonce, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/api/integrations",
  });
  return response;
}
