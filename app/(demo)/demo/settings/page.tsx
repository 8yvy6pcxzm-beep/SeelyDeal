"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { useLang } from "@/components/i18n/language-provider";
import appConfig from "@/app.config";

/** Read-only Brand settings showcase for the unauthenticated /demo shell. */
export default function DemoSettingsPage() {
  const { t, lang } = useLang();

  return (
    <div className="mx-auto max-w-3xl animate-fade-in space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{lang === "tr" ? "Marka" : "Brand"}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {lang === "tr"
              ? "Bunlar app.config.ts dosyasından gelir. Değiştirmek için kurulumu tekrar çalıştır."
              : "These come from app.config.ts. Re-run setup to change them."}
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{lang === "tr" ? "Ürün adı" : "Product name"}</Label>
            <Input defaultValue={appConfig.name} readOnly disabled />
          </div>
          <div className="space-y-1.5">
            <Label>{lang === "tr" ? "Alan adı" : "Domain"}</Label>
            <Input defaultValue={appConfig.domain} readOnly disabled />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{lang === "tr" ? "Slogan" : "Tagline"}</Label>
            <Input defaultValue={t(appConfig.tagline)} readOnly disabled />
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {lang === "tr"
          ? "Bu bir gösterim ekranıdır, örnek verilerle doldurulmuştur."
          : "This is a showcase screen, filled with sample data."}
      </p>
    </div>
  );
}
