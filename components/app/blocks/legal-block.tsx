"use client";

import { useEffect, useRef } from "react";
import { BlockSignForm, type BlockSignState, CompanySignBadge, type CompanySignState } from "@/components/app/blocks/block-sign-form";

/** Editable text block for per-proposal legal clauses (NDA, custom addenda, …).
 *  Unlike ContractSignOff (fixed "7th section" caption), a proposal can carry
 *  any number of these. Editing here only ever changes the in-memory block —
 *  callers persist the whole `blocks[]` array via PATCH /api/proposals/[id],
 *  never the `company_documents` row the content may have been copied from. */
export function LegalBlock({
  title,
  content,
  requireSignature,
  lang,
  editable = false,
  onChange,
  sign,
  companySign,
}: {
  title: string;
  content: string;
  requireSignature: boolean;
  lang: "tr" | "en";
  editable?: boolean;
  onChange?: (next: { title: string; content: string; requireSignature: boolean }) => void;
  /** Public-page signing state — omitted in editor previews and read-only surfaces
   *  that don't offer signing (e.g. the proposals-table quick-look). */
  sign?: BlockSignState;
  /** Authenticated "sign on behalf of the company" state — editor previews only,
   *  and only once the proposal has been saved (see ai-draft-dialog.tsx). */
  companySign?: CompanySignState;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize so the clause text isn't stuck in a tiny scrollable box —
  // no shared autosize utility exists in the repo yet, so this is self-contained.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [content, editable]);

  if (!editable) {
    return (
      <div className="rounded-lg border border-border bg-card p-2.5">
        <p className="text-[12.5px] font-semibold">{title}</p>
        {content && <p className="mt-0.5 whitespace-pre-wrap text-[12px] text-muted-foreground">{content}</p>}
        {requireSignature && (
          sign ? (
            <BlockSignForm lang={lang} state={sign} />
          ) : (
            <p className="mt-1 text-[11px] text-muted-foreground">{lang === "tr" ? "İmza gerekli" : "Signature required"}</p>
          )
        )}
        {requireSignature && companySign && <CompanySignBadge lang={lang} state={companySign} />}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <input
        className="w-full bg-transparent text-[13px] font-semibold text-foreground outline-none placeholder:text-muted-foreground/70"
        value={title}
        onChange={(e) => onChange?.({ title: e.target.value, content, requireSignature })}
        placeholder={lang === "tr" ? "Başlık" : "Title"}
      />
      <textarea
        ref={textareaRef}
        className="mt-1.5 w-full resize-none rounded-lg border border-input bg-background px-2.5 py-2 text-[12.5px] leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
        rows={4}
        value={content}
        onChange={(e) => onChange?.({ title, content: e.target.value, requireSignature })}
        placeholder={lang === "tr" ? "Sözleşme metni…" : "Legal text…"}
      />
      <label className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <input
          type="checkbox"
          className="h-3.5 w-3.5 rounded border-input accent-primary"
          checked={requireSignature}
          onChange={(e) => onChange?.({ title, content, requireSignature: e.target.checked })}
        />
        {lang === "tr" ? "İmza gerektir" : "Require signature"}
      </label>
      {requireSignature && companySign && <CompanySignBadge lang={lang} state={companySign} />}
    </div>
  );
}
