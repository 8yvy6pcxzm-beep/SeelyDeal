/** The small, curated set of display fonts a proposal (or a company's default)
 * can use — kept intentionally short rather than an open font picker, so Seely's
 * onboarding upload analysis (or a chosen template) can classify into one of these
 * with confidence. "default" needs no extra Google Fonts load — it's the app's own
 * Instrument Sans display font, already wired via --font-display-app in app/layout.tsx. */
export const PROPOSAL_FONT_KEYS = ["default", "bold", "elegant"] as const;
export type ProposalFontKey = (typeof PROPOSAL_FONT_KEYS)[number];

export function isProposalFontKey(value: unknown): value is ProposalFontKey {
  return typeof value === "string" && (PROPOSAL_FONT_KEYS as readonly string[]).includes(value);
}

export const PROPOSAL_FONT_LABELS: Record<ProposalFontKey, { tr: string; en: string }> = {
  default: { tr: "Modern (varsayılan)", en: "Modern (default)" },
  bold: { tr: "Kalın / vurgulu", en: "Bold / display" },
  elegant: { tr: "Zarif / seri", en: "Elegant / serif" },
};
