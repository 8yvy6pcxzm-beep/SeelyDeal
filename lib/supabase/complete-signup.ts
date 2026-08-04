import { createServiceClient } from "@/lib/supabase/server";

/**
 * Bootstraps a brand-new signup: creates the company row and links the auth
 * user to it as owner. Shared by the email/password signup route and the
 * OAuth callback, since both need to create the company/profile row the
 * first time a given auth user shows up.
 */
export async function completeSignup(userId: string, email: string, companyName?: string) {
  const supabase = createServiceClient();

  const { data: existing } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (existing) {
    return { ok: true as const, alreadyLinked: true };
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({ name: companyName || email.split("@")[0], email, plan: "lite" })
    .select("id")
    .single();

  if (companyError) {
    return { ok: false as const, error: companyError.message };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .insert({ id: userId, company_id: company.id, role: "owner" });

  if (profileError) {
    return { ok: false as const, error: profileError.message };
  }

  return { ok: true as const, companyId: company.id as string };
}
