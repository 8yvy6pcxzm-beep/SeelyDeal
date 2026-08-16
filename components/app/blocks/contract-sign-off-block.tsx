"use client";

import { BlockSignForm, type BlockSignState } from "@/components/app/blocks/block-sign-form";

// Splits contract text into numbered clauses when written as "1. ... 2. ..."; falls back to one block.
function splitClauses(text: string): string[] {
  const clauses = text.split(/(?=\n?\d+\.\s)/).map((c) => c.trim()).filter(Boolean);
  return clauses.length > 1 ? clauses : [text];
}

export function ContractSignOffBlock({
  contractText,
  lang,
  sign,
}: {
  contractText?: string;
  lang: "tr" | "en";
  /** Public-page signing state — omitted in editor previews. */
  sign?: BlockSignState;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-2.5">
      <p className="text-[12.5px] font-semibold">{lang === "tr" ? "Sözleşme ve Onay / İmza" : "Contract & Sign-off"}</p>
      {contractText && (
        <div className="mt-1 space-y-1.5">
          {splitClauses(contractText).map((clause, i) => (
            <p key={i} className="whitespace-pre-wrap text-[12px] leading-relaxed text-muted-foreground">
              {clause}
            </p>
          ))}
        </div>
      )}
      {sign && <BlockSignForm lang={lang} state={sign} />}
    </div>
  );
}
