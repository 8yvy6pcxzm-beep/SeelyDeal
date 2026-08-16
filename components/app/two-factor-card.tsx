"use client";

import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLang } from "@/components/i18n/language-provider";

export function TwoFactorCard() {
  const { lang } = useLang();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          {lang === "tr" ? "İki Adımlı Doğrulama (2FA)" : "Two-Factor Authentication (2FA)"}
          <Badge tone="neutral">{lang === "tr" ? "Yakında" : "Coming soon"}</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {lang === "tr"
            ? "Girişte şifreye ek olarak authenticator uygulamandan bir kod iste."
            : "Ask for a code from your authenticator app in addition to your password at sign-in."}
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4 rounded-lg border border-dashed border-border bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">
            {lang === "tr"
              ? "Bu özellik altyapıda hazır ancak henüz müşteri kullanımına açılmadı — yakında etkinleştirilebilir olacak."
              : "This feature is built and ready, but not yet enabled for customer use — activation is coming soon."}
          </p>
          <button
            type="button"
            disabled
            className="shrink-0 cursor-not-allowed rounded-lg bg-foreground/40 px-4 py-2 text-sm font-medium text-background/80"
          >
            {lang === "tr" ? "Etkinleştir" : "Enable"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
