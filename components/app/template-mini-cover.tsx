"use client";

/** A dynamic, theme-driven cover preview for a template gallery card — an inline
 *  SVG "mini cover" gradient + a wireframe content card on top, generated purely
 *  from the template's colors. Used as the default cover for every template that
 *  has no `previewImage`, and stays in the project's photo-free, inline-SVG
 *  design language (see CLAUDE.md). */
export function TemplateMiniCover({
  primaryColor,
  accentColor,
  className,
}: {
  primaryColor: string;
  accentColor?: string;
  className?: string;
}) {
  const accent = accentColor ?? primaryColor;
  const gradientId = `tmc-grad-${primaryColor}-${accent}`.replace(/[^a-zA-Z0-9-]/g, "");

  return (
    <div className={className ?? "relative h-32 w-full overflow-hidden rounded-xl"}>
      <svg
        viewBox="0 0 320 160"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={primaryColor} stopOpacity="0.16" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.28" />
          </linearGradient>
        </defs>
        <rect width="320" height="160" fill={`url(#${gradientId})`} />
        <circle cx="284" cy="20" r="46" fill={accent} opacity="0.22" />
        <circle cx="20" cy="150" r="34" fill={primaryColor} opacity="0.16" />
      </svg>

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-28 rounded-lg border border-border bg-card p-2.5 shadow-pill">
          <div className="h-2 w-12 rounded-full" style={{ background: primaryColor }} />
          <div className="mt-2 space-y-1">
            <div className="h-1.5 w-full rounded-full bg-muted" />
            <div className="h-1.5 w-3/4 rounded-full bg-muted" />
            <div className="h-1.5 w-5/6 rounded-full bg-muted" />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className="h-2 w-8 rounded-full bg-muted" />
            <div className="h-2 w-6 rounded-full" style={{ background: accent }} />
          </div>
        </div>
      </div>
    </div>
  );
}
