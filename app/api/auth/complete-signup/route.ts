import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";
import { completeSignup } from "@/lib/supabase/complete-signup";

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

  if (!email) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }

  const result = await completeSignup(authedUser.id, email, companyName);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(result);
}
