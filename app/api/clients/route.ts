import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";
import { encryptField, decryptField } from "@/lib/crypto";

/**
 * Clients list/create now goes through the server (not a direct browser
 * Supabase call) so email/website can be encrypted on write and decrypted
 * on read — the encryption key never reaches the browser bundle.
 */
export async function GET(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 });

  const [{ data: clientRows }, { data: proposalRows }] = await Promise.all([
    service.from("clients").select("*").eq("company_id", profile.company_id).order("created_at", { ascending: false }),
    service.from("proposals").select("client_id, value, status, created_at").eq("company_id", profile.company_id),
  ]);

  const clients = (clientRows ?? []).map((c: { email: string | null; website: string | null; [key: string]: unknown }) => ({
    ...c,
    email: decryptField(c.email),
    website: decryptField(c.website),
  }));

  return NextResponse.json({ clients, proposals: proposalRows ?? [] });
}

export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 });

  const { name, email, website } = (await req.json()) as { name?: string; email?: string; website?: string };
  if (!name?.trim()) return NextResponse.json({ error: "İsim gerekli." }, { status: 400 });

  const { data, error } = await service
    .from("clients")
    .insert({
      company_id: profile.company_id,
      name: name.trim(),
      email: encryptField(email?.trim()),
      website: encryptField(website?.trim()),
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ client: { ...data, email: email?.trim() || null, website: website?.trim() || null } });
}
