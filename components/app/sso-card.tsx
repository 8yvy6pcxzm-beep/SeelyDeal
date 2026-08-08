"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useLang } from "@/components/i18n/language-provider";
import { createClient } from "@/lib/supabase/client";

type Provider = "okta" | "azure_ad" | "salesforce";
type Config = {
  sso_enabled: boolean;
  sso_provider: Provider | null;
  sso_domain: string | null;
  sso_metadata_url: string | null;
  sso_configured_at: string | null;
};

const PROVIDER_LABEL: Record<Provider, string> = { okta: "Okta", azure_ad: "Azure AD", salesforce: "Salesforce" };

async function authHeader() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" };
}

export function SsoCard() {
  const { lang } = useLang();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [provider, setProvider] = useState<Provider>("okta");
  const [domain, setDomain] = useState("");
  const [metadataUrl, setMetadataUrl] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [configuredAt, setConfiguredAt] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/settings/sso", { headers: await authHeader() });
      const data = await res.json();
      if (res.ok) {
        const c: Config = data.config;
        if (c.sso_provider) setProvider(c.sso_provider);
        setDomain(c.sso_domain ?? "");
        setMetadataUrl(c.sso_metadata_url ?? "");
        setEnabled(c.sso_enabled);
        setConfiguredAt(c.sso_configured_at);
      } else {
        setError(data.error ?? null);
      }
      setLoading(false);
    })();
  }, []);

  async function save(nextEnabled: boolean) {
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/settings/sso", {
      method: "POST",
      headers: await authHeader(),
      body: JSON.stringify({ provider, domain, metadataUrl, enabled: nextEnabled }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
    } else {
      setEnabled(nextEnabled);
      setConfiguredAt(nextEnabled ? new Date().toISOString() : null);
      setSaved(true);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          {lang === "tr" ? "SSO desteği" : "SSO support"}
          {enabled && <Badge tone="success">{lang === "tr" ? "Bağlı" : "Connected"}</Badge>}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {lang === "tr"
            ? "Okta, Azure AD ve Salesforce gibi kurumsal kimlik sağlayıcılarınızla entegre olun."
            : "Integrate with enterprise identity providers like Okta, Azure AD, and Salesforce."}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{lang === "tr" ? "Kimlik sağlayıcı" : "Identity provider"}</Label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as Provider)}
              className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
            >
              {(["okta", "azure_ad", "salesforce"] as const).map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{lang === "tr" ? "Şirket e-posta domaini" : "Company email domain"}</Label>
            <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="seelynow.ink" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{lang === "tr" ? "IdP metadata URL" : "IdP metadata URL"}</Label>
            <Input
              value={metadataUrl}
              onChange={(e) => setMetadataUrl(e.target.value)}
              placeholder={`https://${provider === "azure_ad" ? "login.microsoftonline.com/..." : provider + ".com/app/.../sso/saml/metadata"}`}
            />
          </div>
        </div>

        <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          {lang === "tr" ? (
            <>
              Bu ayarlar kaydedildikten sonra, tek oturum açmayı tamamlamak için Supabase projenizde
              (Enterprise SSO eklentisi altında) bu domain için bir SAML sağlayıcı kaydı yapılması gerekir —{" "}
              <code className="rounded bg-background px-1">supabase projects api-keys</code> ile aldığınız
              service-role bilgilerini kullanarak Supabase destek ekibiyle ya da CLI'daki{" "}
              <code className="rounded bg-background px-1">auth sso add</code> komutuyla kurulur. O adım
              tamamlandığında giriş sayfasındaki "Kurumsal SSO ile giriş" alanı bu domain'i otomatik tanır.
            </>
          ) : (
            <>
              After saving, finishing single sign-on requires registering a SAML provider for this domain on
              your Supabase project (Enterprise SSO add-on) — via Supabase support or the CLI's{" "}
              <code className="rounded bg-background px-1">auth sso add</code> command. Once that's done, the
              "Sign in with SSO" field on the login page picks up this domain automatically.
            </>
          )}
        </div>

        {configuredAt && (
          <p className="text-xs text-muted-foreground">
            {lang === "tr" ? "Son güncelleme" : "Last updated"}: {new Date(configuredAt).toLocaleString(lang === "tr" ? "tr-TR" : "en-US")}
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          {saved && <span className="text-sm text-success">{lang === "tr" ? "Kaydedildi" : "Saved"}</span>}
          {enabled && (
            <Button variant="outline" disabled={saving} onClick={() => save(false)}>
              {lang === "tr" ? "Bağlantıyı kaldır" : "Disconnect"}
            </Button>
          )}
          <Button disabled={saving || !domain.trim() || !metadataUrl.trim()} onClick={() => save(true)}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : enabled ? (lang === "tr" ? "Güncelle" : "Update") : lang === "tr" ? "Bağla" : "Connect"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
