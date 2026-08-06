"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Link2, Eye } from "lucide-react";
import { StatusPill, ClientAvatar } from "@/components/app/proposal-bits";
import { useLang } from "@/components/i18n/language-provider";
import { formatUsd } from "@/lib/utils";
import type { ProposalRow } from "@/lib/demo/data";

/**
 * Read-only quick-look for a row in the /proposals table — separate from the
 * Dashboard cockpit's detail drawer, which is wired to dashboard-only state
 * (reminders, e-sign polling) that isn't worth threading through here. This
 * just answers "what's actually in this proposal" without leaving the list.
 */
export function ProposalPreviewDialog({
  proposal,
  clientLinkHref,
  onClose,
}: {
  proposal: ProposalRow | null;
  clientLinkHref: string | null;
  onClose: () => void;
}) {
  const { t, lang } = useLang();
  // Rendered via a portal to <body> — the app shell wraps its content in
  // overflow-hidden panes, which clips a plain `fixed inset-0` element to
  // the content pane instead of the real viewport, leaving the sidebar
  // uncovered. Mounted-guard avoids touching `document` during SSR.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!proposal || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="font-semibold">{lang === "tr" ? "Teklif önizlemesi" : "Proposal preview"}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
            <ClientAvatar initials={proposal.clientInitials} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold leading-tight">{t(proposal.title)}</p>
              <p className="truncate text-xs text-muted-foreground">
                <span className="tnum">{proposal.number}</span> · {proposal.client}
              </p>
            </div>
            <StatusPill status={proposal.status} lang={lang} />
          </div>

          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{lang === "tr" ? "Anlaşma değeri" : "Deal value"}</p>
              <p className="tnum mt-1 text-2xl font-bold leading-none">{formatUsd(proposal.value)}</p>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Eye className="h-3.5 w-3.5" />
              {proposal.views} {lang === "tr" ? "görüntüleme" : "views"}
            </p>
          </div>

          {proposal.sections?.length > 0 && (
            <div>
              <p className="label-mono pb-2 text-muted-foreground">{lang === "tr" ? "Bölümler" : "Sections"}</p>
              <div className="space-y-1.5">
                {proposal.sections.map((sec, i) => (
                  <div key={sec.key} className="rounded-lg border border-border bg-card p-2.5">
                    <p className="flex items-center gap-2 text-[12.5px] font-semibold">
                      <span className="tnum text-[10px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                      {t(sec.title)}
                    </p>
                    <p className="mt-0.5 pl-6 text-[12px] text-muted-foreground">{t(sec.preview)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {proposal.lineItems?.length > 0 && (
            <div>
              <p className="label-mono pb-2 text-muted-foreground">{lang === "tr" ? "Kalemler" : "Line items"}</p>
              <table className="w-full text-sm">
                <tbody>
                  {proposal.lineItems.map((li) => (
                    <tr key={li.id} className="border-t border-border first:border-0">
                      <td className="py-1.5">
                        {t(li.name)} × {li.qty}
                        {li.optional && (
                          <span className="ml-1.5 text-[10px] text-muted-foreground">
                            ({lang === "tr" ? "opsiyonel" : "optional"})
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 text-right tnum">{formatUsd(li.unit * li.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {clientLinkHref && (
            <a
              href={clientLinkHref}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-lg border border-border py-2.5 text-[13px] font-semibold transition-colors hover:bg-muted"
            >
              <Link2 className="h-3.5 w-3.5" />
              {lang === "tr" ? "Müşteri linkini aç" : "Open client link"}
            </a>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
