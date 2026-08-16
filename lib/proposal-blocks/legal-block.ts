import type { ProposalBlock } from "@/lib/types/proposal-blocks";

/** Minimal shape this needs from a `company_documents` row — see
 *  components/app/content-library-client.tsx for the full `CompanyDocument` type. */
export type LibraryDocumentLike = {
  id: string;
  title: string;
  content: string | null;
};

/** Turns a Content Library document into a standalone "Legal" block for a
 *  single proposal. This is always a deep copy: the returned block owns its
 *  own `content` string and has no live reference back to `company_documents`.
 *  Editing the block (via PATCH /api/proposals/[id]) can never mutate the
 *  source library row — the two are only linked by `sourceDocumentId`, which
 *  is display-only. */
export function createLegalBlockFromDocument(doc: LibraryDocumentLike): ProposalBlock {
  return {
    id: `legal-${doc.id}-${Date.now()}`,
    type: "Legal",
    title: doc.title,
    content: doc.content ?? "",
    settings: { requireSignature: false },
    sourceDocumentId: doc.id,
  };
}
