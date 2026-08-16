/** Faz 1 — typed, orderable proposal blocks. Two kinds:
 *  - structural (own renderer, data comes from the surrounding proposal, not the block itself):
 *    HeroCover, PricingTable, ContractSignOff
 *  - content (single reusable renderer, freely added/removed/reordered): RichSection
 *  See components/app/blocks/block-renderer.tsx for the render engine and
 *  lib/proposal-blocks/convert-legacy.ts for the fallback that builds this
 *  array out of a proposal that has no `blocks` saved yet. */
export type ProposalBlock =
  | { id: string; type: "HeroCover" }
  | {
      id: string;
      type: "RichSection";
      label: string;
      body: string;
      icon?: "team" | "timeline" | "strategy";
      videoUrl?: string;
      condition?: { lineItem?: string; billingKey?: string };
      /** Original index in the source `sections[]` array — only meaningful on the
       *  public proposal page, where it's needed for the per-section view-time
       *  IntersectionObserver (`data-section-index`). Other consumers ignore it. */
      sectionIndex?: number;
    }
  | { id: string; type: "PricingTable" }
  | { id: string; type: "ContractSignOff"; contractText?: string };
