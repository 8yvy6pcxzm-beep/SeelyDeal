import { formatUsd } from "@/lib/utils";

export function HeroCoverBlock({ title, client, value, lang }: { title: string; client: string; value: number; lang: "tr" | "en" }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3.5">
      <p className="truncate text-[15px] font-semibold leading-tight">{title}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{client}</p>
      <p className="tnum mt-2 text-xl font-bold leading-none">{formatUsd(value)}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {lang === "tr" ? "Kapak" : "Cover"}
      </p>
    </div>
  );
}
