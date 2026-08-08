import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";
import { decryptField } from "@/lib/crypto";

/** KVKK m.11 — lets a user download everything stored about their account and company. */
export async function GET(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("id, email, role, permissions, created_at, company_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 });

  const [company, teammates, clients, proposals, documents, templates] = await Promise.all([
    service.from("companies").select("*").eq("id", profile.company_id).maybeSingle(),
    service.from("profiles").select("id, email, role, created_at").eq("company_id", profile.company_id),
    service.from("clients").select("*").eq("company_id", profile.company_id),
    service.from("proposals").select("*").eq("company_id", profile.company_id),
    service.from("company_documents").select("*").eq("company_id", profile.company_id),
    service.from("templates").select("*").eq("company_id", profile.company_id),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    profile,
    company: company.data,
    teammates: teammates.data ?? [],
    clients: (clients.data ?? []).map((c: { email: string | null; website: string | null; [key: string]: unknown }) => ({
      ...c,
      email: decryptField(c.email),
      website: decryptField(c.website),
    })),
    proposals: proposals.data ?? [],
    documents: documents.data ?? [],
    templates: templates.data ?? [],
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="seelydeal-veri-export-${profile.company_id}.json"`,
    },
  });
}
