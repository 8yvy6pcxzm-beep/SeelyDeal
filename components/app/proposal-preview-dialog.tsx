"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Link2, Eye, Download } from "lucide-react";
import { StatusPill, ClientAvatar } from "@/components/app/proposal-bits";
import { useLang } from "@/components/i18n/language-provider";
import { formatUsd } from "@/lib/utils";
import type { ProposalRow } from "@/lib/demo/data";
import { legacyToBlocks } from "@/lib/proposal-blocks/convert-legacy";
import { BlockRenderer } from "@/components/app/blocks/block-renderer";

/** ProposalRow (the demo dashboard list row) is a preview-only shape —
 *  `sections[].preview` is a short teaser, not the full body — but its
 *  section `key`s already line up with block types, so this maps almost
 *  directly onto the shared legacy→blocks converter instead of needing a
 *  bespoke one. */
function proposalRowToBlocks(proposal: ProposalRow, t: (l: { tr: string; en: string }) => string) {
  const nonCoverSections = proposal.sections.filter((s) => s.key !== "cover");
  const contractSection = nonCoverSections.find((s) => s.key === "terms" || s.key === "sign");
  const richSections = nonCoverSections.filter((s) => s !== contractSection && s.key !== "pricing");
  return legacyToBlocks({
    sections: richSections.map((s) => ({ title: t(s.title), body: t(s.preview) })),
    lineItems: proposal.lineItems,
    contractText: contractSection ? t(contractSection.preview) : undefined,
  });
}

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

  // Authenticated "sign on behalf of the company" state for Legal/ContractSignOff
  // blocks — same pattern as ai-draft-dialog.tsx's editor preview, just here for
  // the read-only quick-look (this dialog is only reachable from inside the app).
  const [companySignatures, setCompanySignatures] = useState<Record<string, { signerName: string; signedAt: string }>>({});
  const [companySigningBlockId, setCompanySigningBlockId] = useState<string | null>(null);
  const [companySignErrors, setCompanySignErrors] = useState<Record<string, string>>({});

  // Hydrate from the proposal's own block_signatures every time a (possibly different)
  // proposal opens — without this, the badge only showed "signed" after a same-session
  // click and reverted to the plain button on reopen/refresh even though the DB row exists.
  useEffect(() => {
    if (!proposal) {
      setCompanySignatures({});
      return;
    }
    const fromServer = Object.fromEntries(
      (proposal.blockSignatures ?? [])
        .filter((s) => s.signerRole === "company")
        .map((s) => [s.blockId, { signerName: s.signerName, signedAt: s.signedAt }]),
    );
    setCompanySignatures(fromServer);
    setCompanySignErrors({});
  }, [proposal]);

  async function handleCompanySign(blockId: string, blockType: "Legal" | "ContractSignOff") {
    if (!proposal) return;
    setCompanySigningBlockId(blockId);
    setCompanySignErrors((prev) => ({ ...prev, [blockId]: "" }));
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/blocks/${blockId}/company-sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (lang === "tr" ? "İmzalanamadı." : "Couldn't sign."));
      setCompanySignatures((prev) => ({
        ...prev,
        [blockId]: { signerName: data.signature.signer_name, signedAt: data.signature.signed_at },
      }));
    } catch (e) {
      setCompanySignErrors((prev) => ({ ...prev, [blockId]: e instanceof Error ? e.message : String(e) }));
    } finally {
      setCompanySigningBlockId(null);
    }
  }

  function getCompanySignState(blockId: string, blockType: "Legal" | "ContractSignOff") {
    return {
      signature: companySignatures[blockId] ?? null,
      signing: companySigningBlockId === blockId,
      onSign: () => handleCompanySign(blockId, blockType),
      error: companySignErrors[blockId] || null,
    };
  }

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

          <BlockRenderer
            blocks={proposalRowToBlocks(proposal, t).filter((b) => b.type !== "HeroCover")}
            ctx={{
              title: t(proposal.title),
              client: proposal.client,
              value: proposal.value,
              lineItems: proposal.lineItems.map((li) => ({ id: li.id, name: t(li.name), unit: li.unit, qty: li.qty, optional: li.optional })),
              lang,
              getCompanySignState,
            }}
          />

          <div className="flex gap-2">
            {clientLinkHref && (
              <a
                href={clientLinkHref}
                target="_blank"
                rel="noreferrer"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-2.5 text-[13px] font-semibold transition-colors hover:bg-muted"
              >
                <Link2 className="h-3.5 w-3.5" />
                {lang === "tr" ? "Müşteri linkini aç" : "Open client link"}
              </a>
            )}
            <a
              href={`/api/proposals/${proposal.id}/pdf`}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-2.5 text-[13px] font-semibold transition-colors hover:bg-muted"
            >
              <Download className="h-3.5 w-3.5" />
              {lang === "tr" ? "PDF olarak indir" : "Download as PDF"}
            </a>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
