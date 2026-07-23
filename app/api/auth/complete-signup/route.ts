import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Bootstraps a brand-new signup: creates the company row and links the
 * auth user to it as owner. Runs with the service role so it isn't blocked
 * by RLS before the profile linking it exists.
 */
export async function POST(req: Request) {
  const { userId, email, companyName } = await req.json();

  if (!userId || !email) {
    return NextResponse.json({ error: "Missing userId or email" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: existing } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, alreadyLinked: true });
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({ name: companyName || email.split("@")[0], email })
    .select("id")
    .single();

  if (companyError) {
    return NextResponse.json({ error: companyError.message }, { status: 500 });
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .insert({ id: userId, company_id: company.id, role: "owner" });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, companyId: company.id });
}
