"use client";

import { useState } from "react";
import { FileText, Eye } from "lucide-react";
import { useLang } from "@/components/i18n/language-provider";
import { formatUsd } from "@/lib/utils";
import { proposals } from "@/lib/demo/data";
import { StatusPill, ClientAvatar } from "@/components/app/proposal-bits";
import { Sparkline } from "@/components/app/charts";
import { Card } from "@/components/ui/card";

/** Read-only Proposals showcase for the unauthenticated /demo shell — reuses the same curated rows the real dashboard demos with, minus any editing/sending actions. */
export default function DemoProposalsPage() {
  const { t, lang } = useLang();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = proposals.find((p) => p.id === openId) ?? null;

  return (
    <div className="mx-auto max-w-[1200px] animate-fade-in space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {lang === "tr" ? "Teklifler" : "Proposals"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {lang === "tr"
            ? "Gönderilen her teklifin durumu, görüntülenmesi ve değeri tek yerde."
            : "Every sent proposal's status, view activity, and value in one place."}
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <div className="grid min-w-[720px] grid-cols-[1fr_auto_auto_auto_auto] gap-4 border-b border-border px-6 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>{lang === "tr" ? "Müşteri / Teklif" : "Client / Proposal"}</span>
            <span>{lang === "tr" ? "Durum" : "Status"}</span>
            <span>{lang === "tr" ? "Görüntüleme" : "Views"}</span>
            <span>{lang === "tr" ? "Değer" : "Value"}</span>
            <span />
          </div>
          <div className="min-w-[720px] divide-y divide-border">
            {proposals.map((p) => (
              <button
                key={p.id}
                onClick={() => setOpenId(p.id)}
                className="grid w-full grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 px-6 py-3.5 text-left transition-colors hover:bg-muted"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <ClientAvatar initials={p.clientInitials} />
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-medium">{p.client}</p>
                    <p className="truncate text-[12px] text-muted-foreground">
                      {p.number} · {t(p.title)}
                    </p>
                  </div>
                </div>
                <StatusPill status={p.status} lang={lang} />
                <div className="flex items-center gap-2">
                  <Sparkline data={p.spark} className="h-6 w-16" />
                  <span className="flex items-center gap-1 text-[12.5px] tabular-nums text-muted-foreground">
                    <Eye className="h-3.5 w-3.5" /> {p.views}
                  </span>
                </div>
                <span className="text-[13.5px] font-medium tabular-nums">{formatUsd(p.value)}</span>
                <span />
              </button>
            ))}
          </div>
        </div>
      </Card>

      {open && (
        <>
          <div className="fixed inset-0 z-30 bg-black/30" onClick={() => setOpenId(null)} />
          <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md overflow-y-auto border-l border-border bg-card p-6 shadow-pop">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ClientAvatar initials={open.clientInitials} size={40} />
                <div>
                  <p className="text-[14.5px] font-semibold">{open.client}</p>
                  <p className="text-[12.5px] text-muted-foreground">{open.number}</p>
                </div>
              </div>
              <button
                onClick={() => setOpenId(null)}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-1">
              <p className="text-[13px] font-medium text-muted-foreground">{t(open.title)}</p>
              <StatusPill status={open.status} lang={lang} />
            </div>

            <div className="mt-5 rounded-xl border border-border bg-muted/40 p-4">
              <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                <FileText className="h-3.5 w-3.5" /> {t(open.viewSummary)}
              </p>
            </div>

            <div className="mt-5 space-y-2">
              {open.lineItems.map((li) => (
                <div key={li.id} className="flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">
                    {t(li.name)} × {li.qty}
                  </span>
                  <span className="tabular-nums">{formatUsd(li.unit * li.qty)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-border pt-2 text-[13.5px] font-semibold">
                <span>{lang === "tr" ? "Toplam" : "Total"}</span>
                <span className="tabular-nums">{formatUsd(open.value)}</span>
              </div>
            </div>
          </div>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        {lang === "tr"
          ? "Bu bir gösterim ekranıdır, örnek verilerle doldurulmuştur."
          : "This is a showcase screen, filled with sample data."}
      </p>
    </div>
  );
}
