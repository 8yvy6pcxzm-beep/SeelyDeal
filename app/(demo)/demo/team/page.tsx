"use client";

import { Building2, Shield } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useLang } from "@/components/i18n/language-provider";
import appConfig from "@/app.config";
import { demoTeamMembers } from "@/lib/demo/data";

/** Read-only Company profile / Team showcase for the unauthenticated /demo shell — mirrors CompanyProfileClient's sections with static mock data instead of a real Supabase session. */
export default function DemoTeamPage() {
  const { lang } = useLang();

  return (
    <div className="mx-auto max-w-[900px] animate-fade-in space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {lang === "tr" ? "Şirket profili" : "Company profile"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {lang === "tr" ? "Marka, ekip ve yetkilendirme ayarları." : "Brand, team, and permission settings."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            {lang === "tr" ? "Marka" : "Brand"}
          </CardTitle>
        </CardHeader>
        <div className="flex items-center gap-4 px-6 pb-6">
          <span
            className="grid h-14 w-14 place-items-center rounded-xl text-lg font-semibold text-white"
            style={{ background: "var(--grad-brand)" }}
          >
            {appConfig.name.slice(0, 1)}
          </span>
          <div>
            <p className="text-[14px] font-medium">{appConfig.name}</p>
            <p className="text-[12.5px] text-muted-foreground">{appConfig.domain}</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            {lang === "tr" ? "Ekip ve roller" : "Team & roles"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {lang === "tr"
              ? "Custom pakette her ekip üyesi kendi rolüne göre kısıtlanmış bir görünüm alır."
              : "On the Custom plan, every team member gets a view scoped to their role."}
          </p>
        </CardHeader>
        <div className="divide-y divide-border">
          {demoTeamMembers.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-6 py-3.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-[13px] font-semibold text-primary">
                {m.initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium">{m.name}</p>
                <p className="truncate text-[12px] text-muted-foreground">{m.email}</p>
              </div>
              <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                {lang === "tr" ? m.role.tr : m.role.en}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        {lang === "tr"
          ? "Bu bir gösterim ekranıdır, örnek verilerle doldurulmuştur."
          : "This is a showcase screen, filled with sample data."}
      </p>
    </div>
  );
}
