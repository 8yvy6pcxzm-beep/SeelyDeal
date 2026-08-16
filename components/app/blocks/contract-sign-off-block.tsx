export function ContractSignOffBlock({ contractText, lang }: { contractText?: string; lang: "tr" | "en" }) {
  return (
    <div className="rounded-lg border border-border bg-card p-2.5">
      <p className="text-[12.5px] font-semibold">{lang === "tr" ? "Sözleşme ve Onay / İmza" : "Contract & Sign-off"}</p>
      {contractText && <p className="mt-0.5 text-[12px] text-muted-foreground">{contractText}</p>}
    </div>
  );
}
