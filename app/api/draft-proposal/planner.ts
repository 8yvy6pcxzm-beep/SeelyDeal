import type { CoreContext } from "./context";
import type { ResolvedTemplate } from "./context";
import type { Intent } from "./orchestrator";

/** Deterministic section planning (see AI-ARCHITECTURE-V2.md §4) — the
 *  code-side counterpart of v1's sectionCatalog + defaultSectionsBlock +
 *  "BÖLÜM SEÇİM SORUSU" prose rule (route.ts:496-527, 627-631). Whenever the
 *  answer is already sitting in `company.default_sections` or a resolved
 *  template, no model call is needed at all — the Clarifier only fires when
 *  genuinely nothing is known yet. */

export const SECTION_LABELS: Record<string, { tr: string; en: string }> = {
  intro: { tr: "Ön Yazı", en: "Intro" },
  about: { tr: "Hakkımızda", en: "About Us" },
  team: { tr: "Ekibimiz", en: "Our Team" },
  scope: { tr: "Hizmet Kapsamı", en: "Scope" },
  process: { tr: "Süreç / Nasıl Çalışıyoruz", en: "Process" },
  pricing: { tr: "Paket ve Ücret", en: "Pricing" },
  terms: { tr: "Sözleşme Şartları", en: "Terms" },
  next: { tr: "Sonraki Adımlar", en: "Next Steps" },
};

/** Always included regardless of preference — matches v1's "ÇEKİRDEK" set. */
export const CORE_SECTIONS = ["intro", "scope", "pricing", "next"] as const;
export const OPTIONAL_SECTIONS = ["about", "team", "process", "terms"] as const;

export type SectionPlan = {
  sections: string[];
  /** true only when there is truly no signal anywhere (no default_sections,
   *  no resolved template, no default company doc) — route.ts hands this
   *  straight to the Clarifier instead of calling the Writer. */
  needsUserChoice: boolean;
  templateSource: "demo" | "company" | "none";
  resolvedTemplate?: ResolvedTemplate;
  /** Doc index ids the Writer should be told exist even before it searches —
   *  currently unused by writer.ts (RAG stays tool-driven per §3), kept as a
   *  typed seam for a future "prefetch the obvious one" optimization. */
  ragHints: string[];
};

export function plan(
  intent: Intent,
  core: CoreContext,
  resolvedTemplate: ResolvedTemplate | undefined,
  opts: { messageCount: number; chatText: string },
): SectionPlan {
  if (resolvedTemplate) {
    return {
      sections: resolvedTemplate.sections.map((s) => s.title),
      needsUserChoice: false,
      templateSource: resolvedTemplate.source,
      resolvedTemplate,
      ragHints: [],
    };
  }

  const defaultSections = core.company?.default_sections;
  if (defaultSections && Object.values(defaultSections).some(Boolean)) {
    const chosen = [...CORE_SECTIONS, ...OPTIONAL_SECTIONS].filter(
      (key) => CORE_SECTIONS.includes(key as (typeof CORE_SECTIONS)[number]) || defaultSections[key],
    );
    return { sections: chosen, needsUserChoice: false, templateSource: "none", ragHints: [] };
  }

  const hasDefaultDoc = core.docsIndex.some((d) => d.type === "proposal_template");
  if (hasDefaultDoc) {
    // A saved default proposal format exists — the Writer follows its own
    // structure once it fetches it via search_content_library, so the
    // Planner doesn't need to guess a section list up front.
    return { sections: [...CORE_SECTIONS], needsUserChoice: false, templateSource: "none", ragHints: ["proposal_template"] };
  }

  // Truly nothing to go on — this is the one case v1 asked the model to ask
  // (BÖLÜM SEÇİM SORUSU). v2 resolves it in code: route.ts sends a `clarify`
  // SSE event with the OPTIONAL_SECTIONS chip set instead of spending a
  // Writer turn on a question the Planner already knows needs asking.
  //
  // BUT only on the very first user message of the conversation
  // (opts.messageCount <= 1, mirroring v1's own `messages.length <= 1` gate
  // for its one-shot onboarding-style questions). default_sections is only
  // ever written by the Writer's set_brand tool — and the Writer never runs
  // while needsUserChoice keeps gating every turn — so without this check a
  // company with no saved preference would be asked the SAME question
  // forever, even after the user answers it via the Clarifier chips (their
  // answer just becomes another short chat message, re-entering this same
  // branch). Past the first turn, fall through to inferring the answer from
  // the chat itself instead of asking again.
  if (opts.messageCount <= 1) {
    return { sections: [...CORE_SECTIONS], needsUserChoice: true, templateSource: "none", ragHints: [] };
  }

  const chosenOptional = OPTIONAL_SECTIONS.filter((key) => {
    const label = SECTION_LABELS[key];
    return opts.chatText.includes(label.tr.toLowerCase()) || opts.chatText.includes(label.en.toLowerCase());
  });
  return { sections: [...CORE_SECTIONS, ...chosenOptional], needsUserChoice: false, templateSource: "none", ragHints: [] };
}
