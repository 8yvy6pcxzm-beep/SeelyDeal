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
  // Paraşüt has a clean, single public OAuth2 API — register a developer app at
  // https://developer.parasut.com and put its client id/secret in
  // PARASUT_CLIENT_ID / PARASUT_CLIENT_SECRET.
  parasut: {
    name: "Paraşüt",
    authorizeUrl: "https://api.parasut.com/oauth/authorize",
    tokenUrl: "https://api.parasut.com/oauth/token",
    scopes: [],
    clientIdEnv: "PARASUT_CLIENT_ID",
    clientSecretEnv: "PARASUT_CLIENT_SECRET",
    requiredFeature: "accounting_integrations",
  },
  // Logo doesn't have one universal public OAuth API like Paraşüt did — it ships
  // several products (Tiger, Go, Start) each with its own integration surface,
  // reached via a Logo Connect / e-Logo developer application. authorizeUrl and
  // tokenUrl below are PLACEHOLDERS — confirm the exact endpoints for your Logo
  // product once you have developer portal access, then put the client id/secret
  // in LOGO_CLIENT_ID / LOGO_CLIENT_SECRET. Until those env vars are set,
  // /api/integrations/logo/connect responds 501 and the Settings/Integrations
  // "Bağlan" button for it stays hidden (oauthReady).
  logo: {
    name: "Logo",
    authorizeUrl: "https://connect.logo.com.tr/oauth/authorize", // TODO: confirm against your Logo product's docs
    tokenUrl: "https://connect.logo.com.tr/oauth/token", // TODO: confirm against your Logo product's docs
    scopes: [],
    clientIdEnv: "LOGO_CLIENT_ID",
    clientSecretEnv: "LOGO_CLIENT_SECRET",
    requiredFeature: "accounting_integrations",
  },
};

export function getCrmProvider(provider: string): CrmProviderConfig | undefined {
  return CRM_PROVIDERS[provider];
}
