"use client";

import { CheckCircle2 } from "lucide-react";
import appConfig from "@/app.config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useLang } from "@/components/i18n/language-provider";
import { planAllows } from "@/lib/plan";
import { usePlan } from "@/components/app/plan-provider";

export function IntegrationsClient({
  connected,
  oauthReady = {},
}: {
  connected: Record<string, boolean>;
  oauthReady?: Record<string, boolean>;
}) {
  const { ui, lang } = useLang();
  const plan = usePlan();
  const crmAllowed = planAllows(plan, "crm_integrations");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{ui.integrations}</CardTitle>
          <p className="text-sm text-muted-foreground">{ui.integrationsHint}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {appConfig.integrations.map((it) => (
            <div key={it.key} className="flex items-center gap-4 rounded-lg border border-border p-4">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-muted text-muted-foreground">
                <Icon name="plug" className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{it.name}</p>
                  {it.required && <Badge tone="warning">{ui.required}</Badge>}
                </div>
                <p className="truncate text-sm text-muted-foreground">{it.purpose}</p>
              </div>
              {it.oauth ? (
                !crmAllowed ? (
                  <span className="text-sm font-medium text-muted-foreground">
                    {lang === "tr" ? "Pro paketinde" : "On Pro plan"}
                  </span>
                ) : oauthReady[it.key] ? (
                  <a href={`/api/integrations/${it.key}/connect`}>
                    <Button variant="secondary" size="sm">
                      Bağlan
                    </Button>
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">Kurulum sırasında etkinleştirilecek</span>
                )
              ) : connected[it.key] ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                  <CheckCircle2 className="h-4 w-4" /> {ui.connected}
                </span>
              ) : it.key === "stripe" ? (
                <span className="text-sm text-muted-foreground/50">
                  {lang === "tr" ? "Yakında" : "Coming soon"}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  {lang === "tr" ? "Kurulum sırasında etkinleştirilecek" : "Activated during setup"}
                </span>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
