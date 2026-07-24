import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";

export async function POST(req: Request) {
  const body = await req.json();
  const { title, client, value, sections, lineItems, contractText, paymentLink, billingOptions, introText, aboutText, clientContact, nextSteps, validDays } = body;

  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profili bulunamadı." }, { status: 404 });

  let clientId: string | null = null;
  if (client) {
    const { data: existing } = await service
      .from("clients")
      .select("id")
      .eq("company_id", profile.company_id)
      .eq("name", client)
      .maybeSingle();

    if (existing) {
      clientId = existing.id;
    } else {
      const { data: created } = await service
        .from("clients")
        .insert({ company_id: profile.company_id, name: client })
        .select("id")
        .single();
      clientId = created?.id ?? null;
    }
  }

  const { data: proposal, error } = await service
    .from("proposals")
    .insert({
      company_id: profile.company_id,
      client_id: clientId,
      title: title || "Yeni teklif",
      value: value || 0,
      sections: sections || [],
      line_items: lineItems || [],
      contract_text: contractText || null,
      payment_link: paymentLink || null,
      billing_options: billingOptions || [],
      intro_text: introText || null,
      about_text: aboutText || null,
      client_contact: clientContact || {},
      next_steps: nextSteps || [],
      valid_days: validDays || 15,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: proposal.id });
}

export async function GET(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ proposals: [] });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ proposals: [] });

  const { data: proposals } = await service
    .from("proposals")
    .select("*, clients(name)")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ proposals: proposals ?? [] });
}
