import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";

/**
 * Bootstraps a brand-new signup: creates the company row and links the
 * auth user to it as owner. Runs with the service role so it isn't blocked
 * by RLS before the profile linking it exists.
 *
 * Requires the caller's own Supabase session (Bearer token) and only ever
 * links the profile to THAT session's user — the client-supplied userId is
 * just a legacy field kept for backwards compatibility, never trusted alone.
 */
export async function POST(req: Request) {
  const { email, companyName } = await req.json();

  const authedUser = await getAuthedUser(req);
  if (!authedUser) {
    return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });
  }
  const userId = authedUser.id;

  if (!email) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: existing } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, alreadyLinked: true });
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({ name: companyName || email.split("@")[0], email, plan: "lite" })
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
