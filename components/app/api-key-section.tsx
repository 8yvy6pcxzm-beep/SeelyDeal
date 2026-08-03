"use client";

import { useEffect, useState } from "react";
import { KeyRound, Copy, Check, Loader2, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLang } from "@/components/i18n/language-provider";
import appConfig from "@/app.config";
import { planAllows } from "@/lib/plan";
import { usePlan } from "@/components/app/plan-provider";

export function ApiKeySection() {
  const { lang } = useLang();
  const plan = usePlan();
  const allowed = planAllows(plan, "api_access");
  const supabase = createClient();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [noCompany, setNoCompany] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setNoCompany(true);
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", auth.user.id).maybeSingle();
      if (!profile) {
        setNoCompany(true);
        setLoading(false);
        return;
      }
      const { data: company } = await supabase.from("companies").select("api_key").eq("id", profile.company_id).maybeSingle();
      setApiKey(company?.api_key ?? null);
      setLoading(false);
    })();
  }, []);

  async function generate() {
    setGenerating(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/settings/api-key", {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      if (res.ok) setApiKey(data.apiKey);
    } finally {
      setGenerating(false);
    }
  }

  if (noCompany) return null;

  if (!allowed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{lang === "tr" ? "API Erişimi" : "API Access"}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {lang === "tr"
              ? "API erişimi Pro ve Custom paketlerinde kullanılabilir. Ücretsiz deneme (Lite) bu özelliği içermez."
              : "API access is available on the Pro and Custom plans. The free trial (Lite) doesn't include this feature."}
          </p>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{lang === "tr" ? "API Erişimi" : "API Access"}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {lang === "tr"
            ? `Kendi anahtarınla ${appConfig.domain}/api/v1/proposals uç noktasına erişebilirsin (kullanım ücretine tabi).`
            : `Use your key to call ${appConfig.domain}/api/v1/proposals (usage costs apply).`}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                <KeyRound className="h-4 w-4" />
              </span>
              <Input value={apiKey ?? (lang === "tr" ? "Henüz anahtar oluşturulmadı" : "No key generated yet")} readOnly className="font-mono text-xs" />
              {apiKey && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(apiKey);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              )}
            </div>
            <Button variant="outline" onClick={generate} disabled={generating} className="gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {apiKey ? (lang === "tr" ? "Anahtarı yenile" : "Regenerate key") : (lang === "tr" ? "Anahtar oluştur" : "Generate key")}
            </Button>
            {apiKey && (
              <p className="text-xs text-muted-foreground">
                {lang === "tr" ? "Yenilersen eski anahtar hemen geçersiz olur." : "Regenerating immediately invalidates the old key."}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
