import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";

export async function POST(req: Request) {
  const body = await req.json();
  const { name, industry, sections, lineItems, blocks, contractText, introText, aboutText, nextSteps, billingOptions, validDays } = body;

  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profili bulunamadı." }, { status: 404 });

  const { data: template, error } = await service
    .from("templates")
    .insert({
      company_id: profile.company_id,
      name: name || "Yeni şablon",
      industry: industry || null,
      sections: Array.isArray(sections) ? sections : [],
      line_items: Array.isArray(lineItems) ? lineItems : [],
      // Same blocks[] a proposal carries (Legal blocks etc.) — without this, saving a
      // draft that has Legal blocks "as a template" silently dropped them.
      blocks: Array.isArray(blocks) ? blocks : [],
      contract_text: contractText || null,
      intro_text: introText || null,
      about_text: aboutText || null,
      next_steps: Array.isArray(nextSteps) ? nextSteps : [],
      billing_options: Array.isArray(billingOptions) ? billingOptions : [],
      valid_days: Number.isFinite(Number(validDays)) ? Number(validDays) : 15,
    })
    .select("id")
    .single();

  if (error) {
    console.error("POST /api/templates insert failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: template.id });
}

export async function GET(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ templates: [] });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ templates: [] });

  const { data: templates } = await service
    .from("templates")
    .select("*")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ templates: templates ?? [] });
}
