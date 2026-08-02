import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";
import { getCrmProvider } from "@/lib/integrations/crm-providers";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/** Exchanges the OAuth2 authorization code for tokens and stores the connection. */
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const config = getCrmProvider(provider);
  if (!config) return NextResponse.json({ error: `Bilinmeyen CRM sağlayıcısı: ${provider}` }, { status: 404 });

  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Bu özellik için giriş yapmalısın." }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 });
  const companyId = profile.company_id;

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return NextResponse.json({ error: "code/state eksik." }, { status: 400 });

  const cookieName = `oauth_state_${provider}`;
  const cookieValue = req.headers
    .get("cookie")
    ?.split("; ")
    .find((c) => c.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);

  if (!cookieValue || !safeEqual(cookieValue, state)) {
    return NextResponse.json({ error: "Geçersiz veya süresi dolmuş bağlantı isteği." }, { status: 400 });
  }

  const clientId = process.env[config.clientIdEnv];
  const clientSecret = process.env[config.clientSecretEnv];
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: `${config.name} entegrasyonu henüz yapılandırılmadı.` }, { status: 501 });
  }

  const tokenRes = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${url.origin}/api/integrations/${provider}/callback`,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.json({ error: `${config.name} token değişimi başarısız oldu.` }, { status: 502 });
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  await service.from("crm_connections").upsert(
    {
      company_id: companyId,
      provider,
      status: "connected",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id,provider" },
  );

  const response = NextResponse.redirect(`${url.origin}/settings`);
  response.cookies.delete(cookieName);
  return response;
}
