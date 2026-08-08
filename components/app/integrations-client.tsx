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

  const sortedIntegrations = [...appConfig.integrations].sort(
    (a, b) => Number(!!connected[b.key]) - Number(!!connected[a.key]),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{ui.integrations}</CardTitle>
          <p className="text-sm text-muted-foreground">{ui.integrationsHint}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {sortedIntegrations.map((it) => (
            <div key={it.key} className="flex items-center gap-4 rounded-lg border border-border p-4">
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
                  connected[it.key]
                    ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon name="plug" className="h-5 w-5" />
              </span>
              <div className="group relative min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium" title={it.purpose}>
                    {it.name}
                  </p>
                  {it.required && <Badge tone="warning">{ui.required}</Badge>}
                </div>
                <div className="pointer-events-none absolute left-0 top-full z-10 mt-2 w-72 max-w-[80vw] rounded-lg border border-border bg-card p-3 text-sm text-foreground opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                  {it.purpose}
                </div>
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
                ) : null
              ) : connected[it.key] ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                  </span>
                  <CheckCircle2 className="h-4 w-4" /> {ui.connected}
                </span>
              ) : it.key === "stripe" ? (
                <span className="text-sm text-muted-foreground/50">
                  {lang === "tr" ? "Yakında" : "Coming soon"}
                </span>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
