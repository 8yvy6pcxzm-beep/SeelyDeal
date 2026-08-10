import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";

/** GET: this user's personal default ("[İsim] Varsayılanı" card — see
 * components/app/content-library-client.tsx for Custom/Pro and
 * components/app/company-profile-client.tsx for Lite). POST: saves it, called by
 * ai-draft-dialog.tsx once the user approves Seely's "bunu varsayılan yapayım mı?"
 * offer (see KİŞİSEL VARSAYILAN rule in app/api/draft-proposal/route.ts). */
export async function GET(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const service = createServiceClient();
  const { data } = await service.from("user_defaults").select("*").eq("profile_id", user.id).maybeSingle();
  return NextResponse.json({ userDefault: data ?? null });
}

export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const { label, templateId, preferredFormat } = (await req.json()) as {
    label?: string;
    templateId?: string;
    preferredFormat?: string;
  };
  if (!label?.trim()) return NextResponse.json({ error: "Bir isim gerekli." }, { status: 400 });

  // The AI can name a built-in (non-DB) template like "standart-kapsamli" —
  // only persist templateId when it's a real UUID, otherwise the uuid column
  // insert fails and the whole default silently never saves.
  const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 });

  const { error } = await service.from("user_defaults").upsert(
    {
      profile_id: user.id,
      company_id: profile.company_id,
      label: label.trim(),
      template_id: templateId && isUuid(templateId) ? templateId : null,
      preferred_format: preferredFormat === "pdf" || preferredFormat === "html" ? preferredFormat : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const service = createServiceClient();
  await service.from("user_defaults").delete().eq("profile_id", user.id);
  return NextResponse.json({ ok: true });
}
