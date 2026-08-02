export type CrmProviderConfig = {
  name: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientIdEnv: string;
  clientSecretEnv: string;
};

/**
 * Provider-agnostic OAuth2 registry. Empty by default — a specific CRM is
 * chosen per customer during setup, at which point one entry is added here
 * (key = provider slug used in /api/integrations/[provider]/*) with no
 * changes needed to the connect/callback/webhook routes themselves.
 *
 * Example shape once a provider is added:
 * hubspot: {
 *   name: "HubSpot",
 *   authorizeUrl: "https://app.hubspot.com/oauth/authorize",
 *   tokenUrl: "https://api.hubapi.com/oauth/v1/token",
 *   scopes: ["crm.objects.contacts.read", "crm.objects.contacts.write"],
 *   clientIdEnv: "HUBSPOT_CLIENT_ID",
 *   clientSecretEnv: "HUBSPOT_CLIENT_SECRET",
 * },
 */
export const CRM_PROVIDERS: Record<string, CrmProviderConfig> = {};

export function getCrmProvider(provider: string): CrmProviderConfig | undefined {
  return CRM_PROVIDERS[provider];
}
