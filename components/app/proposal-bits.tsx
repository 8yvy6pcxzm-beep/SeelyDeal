"use client";

import { Check } from "lucide-react";
import type { ProposalStatus } from "@/lib/demo/data";
import type { Lang, L } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/* Status → label + chip tone, shared across the dashboard and proposals page. */
export const STATUS_META: Record<ProposalStatus, { label: L; dot: string; chip: string }> = {
  draft: { label: { tr: "Taslak", en: "Draft" }, dot: "var(--color-stage-draft)", chip: "bg-muted text-muted-foreground" },
  sent: { label: { tr: "Gönderildi", en: "Sent" }, dot: "var(--color-stage-sent)", chip: "bg-info/12 text-info" },
  viewed: { label: { tr: "Görüntülendi", en: "Viewed" }, dot: "var(--color-stage-viewed)", chip: "bg-accent/12 text-accent" },
  accepted: { label: { tr: "Kabul edildi", en: "Accepted" }, dot: "var(--color-stage-accepted)", chip: "bg-success/12 text-success" },
  declined: { label: { tr: "Reddedildi", en: "Declined" }, dot: "var(--color-stage-declined)", chip: "bg-destructive/10 text-destructive" },
};

export function StatusPill({ status, lang }: { status: ProposalStatus; lang: Lang }) {
  const m = STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold", m.chip)}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.dot }} />
      {m.label[lang]}
    </span>
  );
}

/* Client avatar — gradient tile with initials (no photos). */
export function ClientAvatar({ initials, size = 36 }: { initials: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.34, backgroundImage: "var(--grad-brand)" }}
    >
      {initials}
    </span>
  );
}

export function Checkbox({ checked = false }: { checked?: boolean }) {
  return (
    <span
      className={cn(
        "grid h-4 w-4 place-items-center rounded-[5px] border transition-colors",
        checked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
      )}
    >
      {checked && <Check className="h-3 w-3" strokeWidth={3} />}
    </span>
  );
}
