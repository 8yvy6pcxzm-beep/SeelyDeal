"use client";

import { Users, FileText, DollarSign } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { useLang } from "@/components/i18n/language-provider";
import { formatUsd } from "@/lib/utils";
import { demoClients } from "@/lib/demo/data";

/** Read-only Clients showcase for the unauthenticated /demo shell — the real page queries Supabase with the signed-in user's session, so this uses static mock rows instead. */
export default function DemoClientsPage() {
  const { lang } = useLang();

  return (
    <div className="mx-auto max-w-[1100px] animate-fade-in space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {lang === "tr" ? "Müşteriler" : "Clients"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {lang === "tr"
            ? "Her müşterinin teklif geçmişi ve toplam değeri tek bakışta."
            : "Every client's proposal history and total value at a glance."}
        </p>
      </div>

      <Card>
        <CardHeader className="border-b border-border pb-3">
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>{lang === "tr" ? "Müşteri" : "Client"}</span>
            <span className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> {lang === "tr" ? "Teklif" : "Proposals"}
            </span>
            <span className="flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" /> {lang === "tr" ? "Toplam değer" : "Total value"}
            </span>
          </div>
        </CardHeader>
        <div className="divide-y divide-border">
          {demoClients.map((c) => (
            <div key={c.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-[13px] font-semibold text-primary">
                  {c.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-medium">{c.name}</p>
                  <p className="truncate text-[12px] text-muted-foreground">{c.company}</p>
                </div>
                {c.status === "lead" && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {lang === "tr" ? "Aday" : "Lead"}
                  </span>
                )}
              </div>
              <span className="text-[13.5px] tabular-nums text-foreground">{c.proposalCount}</span>
              <span className="text-[13.5px] font-medium tabular-nums text-foreground">{formatUsd(c.totalValue)}</span>
            </div>
          ))}
        </div>
      </Card>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        {lang === "tr"
          ? "Bu bir gösterim ekranıdır, örnek verilerle doldurulmuştur."
          : "This is a showcase screen, filled with sample data."}
      </p>
    </div>
  );
}
