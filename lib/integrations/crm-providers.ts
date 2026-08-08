import type { GatedFeature } from "@/lib/plan";

export type CrmProviderConfig = {
  name: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientIdEnv: string;
  clientSecretEnv: string;
  /** Which plan gate this provider requires — defaults to "crm_integrations" (Pro+) if omitted. */
  requiredFeature?: GatedFeature;
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
export const CRM_PROVIDERS: Record<string, CrmProviderConfig> = {
  // Custom-plan accounting integration (see lib/plan.ts "accounting_integrations").
  // Requires a Paraşüt developer app (https://developer.parasut.com) — register
  // one and put its client id/secret in PARASUT_CLIENT_ID / PARASUT_CLIENT_SECRET.
  // Until those env vars are set, /api/integrations/parasut/connect responds 501
  // and the Settings/Integrations "Bağlan" button for it stays hidden (oauthReady).
  parasut: {
    name: "Paraşüt",
    authorizeUrl: "https://api.parasut.com/oauth/authorize",
    tokenUrl: "https://api.parasut.com/oauth/token",
    scopes: [],
    clientIdEnv: "PARASUT_CLIENT_ID",
    clientSecretEnv: "PARASUT_CLIENT_SECRET",
    requiredFeature: "accounting_integrations",
  },
};

export function getCrmProvider(provider: string): CrmProviderConfig | undefined {
  return CRM_PROVIDERS[provider];
}
