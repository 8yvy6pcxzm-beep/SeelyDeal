"use client";

import { ShieldCheck, Users } from "lucide-react";
import appConfig from "@/app.config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useLang } from "@/components/i18n/language-provider";
import { ApiKeySection } from "@/components/app/api-key-section";

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
  const { t, ui, lang } = useLang();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Brand */}
      <Card>
        <CardHeader>
          <CardTitle>{ui.brand}</CardTitle>
          <p className="text-sm text-muted-foreground">{ui.brandHint}</p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{ui.productName}</Label>
            <Input defaultValue={appConfig.name} readOnly disabled />
          </div>
          <div className="space-y-1.5">
            <Label>{ui.domain}</Label>
            <Input defaultValue={appConfig.domain} readOnly disabled />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{ui.tagline}</Label>
            <Input defaultValue={t(appConfig.tagline)} readOnly disabled />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button>{ui.saveChanges}</Button>
      </div>

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

      <LockedAccessCard
        icon={<Users className="h-4 w-4 text-muted-foreground" />}
        title={lang === "tr" ? "Kullanıcı rolleri ve yetkilendirme" : "User roles and permissions"}
        description={
          lang === "tr"
            ? "Ekip üyelerinize özel roller atayın; hangi alanlara erişebileceklerini ve hangi işlemleri yapabileceklerini tamamen siz yönetin."
            : "Assign custom roles to your team members — you fully control which areas they can access and what actions they can take."
        }
      />

      <LockedAccessCard
        icon={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
        title={lang === "tr" ? "SSO desteği" : "SSO support"}
        description={
          lang === "tr"
            ? "Okta, Azure AD ve Salesforce gibi kurumsal kimlik sağlayıcılarınızla entegre olun; ekibinizin sisteme tek bir güvenli şifreyle erişmesini sağlayın."
            : "Integrate with enterprise identity providers like Okta, Azure AD, and Salesforce — let your team access the system with a single secure sign-on."
        }
      />
    </div>
  );
}
