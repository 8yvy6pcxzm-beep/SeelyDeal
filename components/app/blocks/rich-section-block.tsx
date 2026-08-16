export function RichSectionBlock({ index, label, body }: { index: number; label: string; body: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-2.5">
      <p className="flex items-center gap-2 text-[12.5px] font-semibold">
        <span className="tnum text-[10px] text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
        {label}
      </p>
      <p className="mt-0.5 pl-6 text-[12px] text-muted-foreground">{body}</p>
    </div>
  );
}
