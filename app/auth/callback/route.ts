import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { completeSignup } from "@/lib/supabase/complete-signup";

/**
 * Supabase OAuth (Google/GitHub) redirects here with a `code` param after
 * the provider consent screen. Exchanges it for a session, then makes sure
 * a company/profile row exists for this user (first-time OAuth sign-in
 * skips the password-based signup flow that normally creates it).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    const user = data?.user;
    if (!error && user?.email) {
      await completeSignup(user.id, user.email, user.user_metadata?.full_name);
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
