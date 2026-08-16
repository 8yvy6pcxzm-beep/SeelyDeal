import type { ProposalBlock } from "@/lib/types/proposal-blocks";

const TEAM_SECTION_RE = /ekib|ekip|team/i;

/** Shape a legacy proposal/draft/template needs to expose for conversion —
 *  a subset of the real DB/Draft fields (see app/api/draft-proposal/route.ts
 *  and components/app/ai-draft-dialog.tsx), already resolved to plain strings. */
export type LegacyProposalLike = {
  sections?: { title: string; body: string }[];
  lineItems?: unknown[];
  contractText?: string;
};

/** Builds a `blocks[]` array out of a proposal/template that predates the
 *  blocks column (or has it empty) — used as a fallback so nothing that
 *  already exists in the DB breaks while consumers migrate one at a time. */
export function legacyToBlocks(p: LegacyProposalLike): ProposalBlock[] {
  const blocks: ProposalBlock[] = [{ id: "cover", type: "HeroCover" }];

  (p.sections ?? []).forEach((sec, i) => {
    blocks.push({
      id: `section-${i}`,
      type: "RichSection",
      label: sec.title,
      body: sec.body,
      icon: TEAM_SECTION_RE.test(sec.title) ? "team" : undefined,
      sectionIndex: i,
    });
  });

  if (p.lineItems && p.lineItems.length > 0) {
    blocks.push({ id: "pricing", type: "PricingTable" });
  }

  if (p.contractText) {
    blocks.push({ id: "contract", type: "ContractSignOff", contractText: p.contractText });
  }

  return blocks;
}
