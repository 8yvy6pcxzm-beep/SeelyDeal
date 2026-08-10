"use client";

import { useEffect, useState } from "react";
import { Star, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLang } from "@/components/i18n/language-provider";

type UserDefault = { label: string; template_id: string | null; preferred_format: string | null };

/** "[İsim] Varsayılanı" card — the signed-in person's own saved default (template +
 * output format), set via Seely noticing a repeated choice (see KİŞİSEL VARSAYILAN
 * rule in app/api/draft-proposal/route.ts) and offering to remember it. Shown in the
 * Content Library for Custom/Pro (components/app/content-library-client.tsx) and in
 * Company Profile for Lite (no content library access there). */
export function PersonalDefaultCard() {
  const { lang } = useLang();
  const [userDefault, setUserDefault] = useState<UserDefault | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings/user-default")
      .then((r) => r.json())
      .then((d) => setUserDefault(d.userDefault ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function remove() {
    setUserDefault(null);
    await fetch("/api/settings/user-default", { method: "DELETE" }).catch(() => {});
  }

  if (loading || !userDefault) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-1.5">
            <Star className="h-4 w-4 fill-primary text-primary" />
            {userDefault.label}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {lang === "tr"
              ? "Aksine bir ayarlama yapana kadar Seely tekliflerini bu ayarlarla hazırlar."
              : "Until you say otherwise, Seely drafts your proposals with these settings."}
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={remove} title={lang === "tr" ? "Varsayılanı sil" : "Remove default"}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {lang === "tr" ? "Çıktı formatı: " : "Output format: "}
          <span className="font-medium text-foreground">
            {userDefault.preferred_format === "pdf" ? "PDF" : userDefault.preferred_format === "html" ? "Link (HTML)" : "—"}
          </span>
        </p>
      </CardContent>
    </Card>
  );
}
