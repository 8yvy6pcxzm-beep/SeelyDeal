import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";
import { planAllows } from "@/lib/plan";
import { hashApiKey } from "@/lib/api-key-auth";

function generateKey() {
  return `sk_live_${randomBytes(24).toString("hex")}`;
}

export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profili bulunamadı." }, { status: 404 });

  const { data: company } = await service.from("companies").select("plan").eq("id", profile.company_id).maybeSingle();
  if (!planAllows(company?.plan, "api_access")) {
    return NextResponse.json({ error: "API erişimi Pro ve Custom paketlerinde kullanılabilir." }, { status: 403 });
  }

  const apiKey = generateKey();
  const { error } = await service
    .from("companies")
    .update({ api_key_hash: hashApiKey(apiKey), api_key_last4: apiKey.slice(-4) })
    .eq("id", profile.company_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Only returned here, right after generation — never stored or served in the clear again.
  return NextResponse.json({ apiKey });
}
