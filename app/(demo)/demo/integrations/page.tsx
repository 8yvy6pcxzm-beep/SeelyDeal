"use client";

import { Check, KeyRound, Plug } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useLang } from "@/components/i18n/language-provider";
import appConfig from "@/app.config";

/** Read-only Integrations showcase for the unauthenticated /demo shell — every integration renders "Connected" and the API key is a fixed placeholder, since there's no real company/session behind this page. */
export default function DemoIntegrationsPage() {
  const { lang } = useLang();

  return (
    <div className="mx-auto max-w-[900px] animate-fade-in space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {lang === "tr" ? "Entegrasyonlar" : "Integrations"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {lang === "tr"
            ? "Custom pakette tüm entegrasyonlar ve gelişmiş API erişimi dahildir."
            : "The Custom plan includes every integration plus advanced API access."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-4 w-4 text-muted-foreground" />
            {lang === "tr" ? "Bağlı servisler" : "Connected services"}
          </CardTitle>
        </CardHeader>
        <div className="divide-y divide-border">
          {appConfig.integrations.map((it) => (
            <div key={it.key} className="flex items-center justify-between gap-4 px-6 py-3.5">
              <div className="min-w-0">
                <p className="text-[13.5px] font-medium">{it.name}</p>
                <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{it.purpose}</p>
              </div>
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
                <Check className="h-3 w-3" />
                {lang === "tr" ? "Bağlı" : "Connected"}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            {lang === "tr" ? "API Erişimi" : "API Access"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {lang === "tr"
              ? `Kendi anahtarınla ${appConfig.domain}/api/v1/proposals uç noktasına erişebilirsin.`
              : `Use your key to call ${appConfig.domain}/api/v1/proposals.`}
          </p>
        </CardHeader>
        <div className="px-6 pb-6">
          <div className="flex h-10 items-center rounded-lg border border-border bg-muted px-3 font-mono text-xs text-muted-foreground">
            sk_live_••••••••••••••••••••7f2a
          </div>
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
