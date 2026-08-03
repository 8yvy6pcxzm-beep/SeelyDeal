import appConfig from "@/app.config";
import { SettingsClient } from "@/components/app/settings-client";
import { CRM_PROVIDERS } from "@/lib/integrations/crm-providers";

/** Server side: an integration is "connected" when all its env vars exist. */
export default function SettingsPage() {
  const connected: Record<string, boolean> = {};
  const oauthReady: Record<string, boolean> = {};
  for (const it of appConfig.integrations) {
    connected[it.key] = it.envVars.every((v) => !!process.env[v]);
    if (it.oauth) oauthReady[it.key] = Object.keys(CRM_PROVIDERS).length > 0;
  }

  return <SettingsClient connected={connected} oauthReady={oauthReady} />;
}
