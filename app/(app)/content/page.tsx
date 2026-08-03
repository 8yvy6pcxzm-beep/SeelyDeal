"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useLang } from "@/components/i18n/language-provider";
import { usePlan } from "@/components/app/plan-provider";
import { planAllows } from "@/lib/plan";

/** Content library actually lives inside Şirket Profili (/team) — this route exists so the
 * sidebar link is clickable and shows the same locked-feature card as Analytics for Lite. */
export default function ContentLibraryPage() {
  const { lang } = useLang();
  const plan = usePlan();
  const router = useRouter();
  const allowed = planAllows(plan, "document_library");

  useEffect(() => {
    if (allowed) router.replace("/team");
  }, [allowed, router]);

  if (allowed) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
