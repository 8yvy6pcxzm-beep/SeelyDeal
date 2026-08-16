import { Check } from "lucide-react";
import { videoEmbedSrc } from "@/lib/video-embed";

type TeamMember = { name: string; title: string | null; photo_url: string | null };

type RichSectionBlockProps = {
  index: number;
  label: string;
  body: string;
  icon?: "team" | "timeline" | "strategy";
  videoUrl?: string;
  team?: TeamMember[];
  /** "card" (default) = the numbered card used in compact previews (editor dialog).
   *  "checklist" = the green-check list item used on the public proposal page. */
  variant?: "card" | "checklist";
  sectionRef?: (el: HTMLDivElement | null) => void;
  dataSectionIndex?: number;
};

export function RichSectionBlock({
  index,
  label,
  body,
  icon,
  videoUrl,
  team,
  variant = "card",
  sectionRef,
  dataSectionIndex,
}: RichSectionBlockProps) {
  const embedSrc = videoUrl ? videoEmbedSrc(videoUrl) : null;

  if (variant === "checklist") {
    return (
      <div
        ref={sectionRef}
        data-section-index={dataSectionIndex ?? index}
        className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-4"
      >
        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{label}</p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{body}</p>
          {icon === "team" && team && team.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3">
              {team.map((m) => (
                <div key={m.name} className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 shadow-pill">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.photo_url!} alt={m.name} className="h-7 w-7 rounded-full object-cover" />
                  <span className="text-xs">
                    <span className="font-semibold">{m.name}</span>
                    {m.title && <span className="text-muted-foreground"> · {m.title}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
          {embedSrc && (
            <div className="mt-3 aspect-video w-full overflow-hidden rounded-lg border border-border">
              <iframe
                src={embedSrc}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={sectionRef} className="rounded-lg border border-border bg-card p-2.5">
      <p className="flex items-center gap-2 text-[12.5px] font-semibold">
        <span className="tnum text-[10px] text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
        {label}
      </p>
      <p className="mt-0.5 pl-6 text-[12px] text-muted-foreground">{body}</p>
    </div>
  );
}
