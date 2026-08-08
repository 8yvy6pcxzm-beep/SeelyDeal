import appConfig from "@/app.config";
import { IntegrationsClient } from "@/components/app/integrations-client";
import { CRM_PROVIDERS } from "@/lib/integrations/crm-providers";

/** Server side: an integration is "connected" when all its env vars exist. */
export default function IntegrationsPage() {
  const connected: Record<string, boolean> = {};
  const oauthReady: Record<string, boolean> = {};
  for (const it of appConfig.integrations) {
    connected[it.key] = it.envVars.length > 0 && it.envVars.every((v) => !!process.env[v]);
    if (it.oauth) oauthReady[it.key] = !!CRM_PROVIDERS[it.key];
  }

  return <IntegrationsClient connected={connected} oauthReady={oauthReady} />;
}
