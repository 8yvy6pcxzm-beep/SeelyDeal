import appConfig from "@/app.config";
import { IntegrationsClient } from "@/components/app/integrations-client";
import { CRM_PROVIDERS } from "@/lib/integrations/crm-providers";

/** Server side: an integration is "connected" when all its env vars exist. */
export default function IntegrationsPage() {
  const connected: Record<string, boolean> = {};
  const oauthReady: Record<string, boolean> = {};
  for (const it of appConfig.integrations) {
    connected[it.key] = it.envVars.every((v) => !!process.env[v]);
    if (it.oauth) oauthReady[it.key] = Object.keys(CRM_PROVIDERS).length > 0;
  }

  return <IntegrationsClient connected={connected} oauthReady={oauthReady} />;
}
