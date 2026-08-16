import type { ProposalBlock } from "@/lib/types/proposal-blocks";
import type { LibraryDocumentLike } from "@/lib/proposal-blocks/legal-block";

/** Turns a Content Library document (service description / content block / other)
 *  into a standalone "RichSection" block for a single proposal — same deep-copy
 *  guarantee as createLegalBlockFromDocument: the block owns its own `body` and
 *  is never written back to `company_documents`. */
export function createTextBlockFromDocument(
  doc: LibraryDocumentLike,
  label: string,
  icon?: "team" | "timeline" | "strategy",
): ProposalBlock {
  return {
    id: `text-${doc.id}-${Date.now()}`,
    type: "RichSection",
    label,
    body: doc.content ?? "",
    ...(icon ? { icon } : {}),
  };
}
