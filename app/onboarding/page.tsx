import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "@/components/app/onboarding-wizard";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", auth.user.id).maybeSingle();
  if (!profile) redirect("/dashboard");

  const { data: company } = await service
    .from("companies")
    .select("name, onboarding_completed")
    .eq("id", profile.company_id)
    .maybeSingle();

  if (company?.onboarding_completed) redirect("/dashboard");

  return <OnboardingWizard initialName={company?.name ?? ""} userEmail={auth.user.email ?? null} />;
}
