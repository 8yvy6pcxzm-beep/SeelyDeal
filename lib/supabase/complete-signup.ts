import { createServiceClient } from "@/lib/supabase/server";

/**
 * Bootstraps a brand-new signup: creates the company row and links the auth
 * user to it as owner. Shared by the email/password signup route and the
 * OAuth callback, since both need to create the company/profile row the
 * first time a given auth user shows up.
 */
export async function completeSignup(userId: string, email: string, companyName?: string, consent?: boolean) {
  const supabase = createServiceClient();

  const { data: existing } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (existing) {
    return { ok: true as const, alreadyLinked: true };
  }

  // Custom-plan team invite: a teammate signing up with an invited email joins
  // that company with the assigned role/permissions instead of getting a new one.
  const { data: invite } = await supabase
    .from("team_invites")
    .select("id, company_id, role, permissions")
    .eq("email", email)
    .maybeSingle();

  if (invite) {
    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      company_id: invite.company_id,
      role: invite.role,
      permissions: invite.permissions,
      email,
      consent_at: consent ? new Date().toISOString() : null,
    });
    if (profileError) {
      return { ok: false as const, error: profileError.message };
    }
    await supabase.from("team_invites").delete().eq("id", invite.id);
    return { ok: true as const, companyId: invite.company_id as string };
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({ name: companyName || "", email, plan: "lite" })
    .select("id")
    .single();

  if (companyError) {
    return { ok: false as const, error: companyError.message };
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: userId,
    company_id: company.id,
    role: "owner",
    email,
    consent_at: consent ? new Date().toISOString() : null,
  });

  if (profileError) {
    return { ok: false as const, error: profileError.message };
  }

  return { ok: true as const, companyId: company.id as string };
}
