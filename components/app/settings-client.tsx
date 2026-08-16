"use client";

import { ShieldCheck, Users } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useLang } from "@/components/i18n/language-provider";
import { ApiKeySection } from "@/components/app/api-key-section";
import { TeamRolesCard } from "@/components/app/team-roles-card";
import { SsoCard } from "@/components/app/sso-card";
import { DataPrivacyCard } from "@/components/app/data-privacy-card";
import { TwoFactorCard } from "@/components/app/two-factor-card";
import { usePlan } from "@/components/app/plan-provider";
import { planAllows } from "@/lib/plan";

function LockedAccessCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  const { lang } = useLang();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
        <p className="text-sm text-muted-foreground">
          {lang === "tr" ? "Custom paketinde kullanılabilir." : "Available on the Custom plan."}
        </p>
      </CardHeader>
    </Card>
  );
}

export function SettingsClient() {
  const { lang } = useLang();
  const plan = usePlan();
  const rolesAllowed = planAllows(plan, "user_roles");
  const ssoAllowed = planAllows(plan, "sso");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Access */}
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {lang === "tr" ? "Erişim" : "Access"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {lang === "tr"
            ? "Şirketinizin SeelyDeal'a nasıl erişildiğini ve dış sistemlerin SeelyDeal'ı nasıl kullanabileceğini yönetin."
            : "Manage how your company accesses SeelyDeal and how external systems can use it."}
        </p>
      </div>

      <ApiKeySection />

      {rolesAllowed ? (
        <TeamRolesCard />
      ) : (
        <LockedAccessCard
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          title={lang === "tr" ? "Kullanıcı rolleri ve yetkilendirme" : "User roles and permissions"}
          description={
            lang === "tr"
              ? "Ekip üyelerinize özel roller atayın; hangi alanlara erişebileceklerini ve hangi işlemleri yapabileceklerini tamamen siz yönetin."
              : "Assign custom roles to your team members — you fully control which areas they can access and what actions they can take."
          }
        />
      )}

      {ssoAllowed ? (
        <SsoCard />
      ) : (
        <LockedAccessCard
          icon={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
          title={lang === "tr" ? "SSO desteği" : "SSO support"}
          description={
            lang === "tr"
              ? "Okta, Azure AD ve Salesforce gibi kurumsal kimlik sağlayıcılarınızla entegre olun; ekibinizin sisteme tek bir güvenli şifreyle erişmesini sağlayın."
              : "Integrate with enterprise identity providers like Okta, Azure AD, and Salesforce — let your team access the system with a single secure sign-on."
          }
        />
      )}

      <DataPrivacyCard />

      {/* Security */}
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {lang === "tr" ? "Güvenlik" : "Security"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {lang === "tr"
            ? "Hesabınıza girişi ekstra bir adımla koruyun."
            : "Protect account sign-in with an extra step."}
        </p>
      </div>

      <TwoFactorCard />
    </div>
  );
}
