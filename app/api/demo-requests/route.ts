import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";
import appConfig from "@/app.config";

/** Demo requests are leads for SeelyDeal itself (not client-scoped), so only the vendor's own account can list them. */
export async function GET(req: Request) {
  const user = await getAuthedUser(req);
  if (!user || user.email !== appConfig.contactEmail) {
    return NextResponse.json({ error: "Yetkin yok." }, { status: 403 });
  }

  const service = createServiceClient();
  const { data: requests, error } = await service.from("demo_requests").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: requests ?? [] });
}

export async function POST(req: Request) {
  const { name, email, company, message, tier } = await req.json();

  if (!name || !email) {
    return NextResponse.json({ error: "İsim ve e-posta gerekli." }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service.from("demo_requests").insert({
    name,
    email,
    company: company || null,
    message: message || null,
    tier: tier || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
