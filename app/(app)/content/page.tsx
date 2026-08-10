"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ContentLibraryClient } from "@/components/app/content-library-client";
import { useLang } from "@/components/i18n/language-provider";
import { usePlan } from "@/components/app/plan-provider";
import { planAllows } from "@/lib/plan";

export default function ContentLibraryPage() {
  const { lang } = useLang();
  const plan = usePlan();
  const allowed = planAllows(plan, "document_library");

  if (!allowed) {
    return (
      <div className="mx-auto max-w-[1100px]">
        <Card>
          <CardHeader>
            <CardTitle>{lang === "tr" ? "İçerik kütüphanesi" : "Content library"}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {lang === "tr"
                ? "İçerik kütüphanesi Pro ve Custom paketlerinde kullanılabilir. Ücretsiz deneme (Lite) bu özelliği içermez."
                : "The content library is available on the Pro and Custom plans. The free trial (Lite) doesn't include this feature."}
            </p>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return <ContentLibraryClient />;
}
