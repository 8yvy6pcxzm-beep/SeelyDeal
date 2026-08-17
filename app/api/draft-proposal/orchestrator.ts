/** Code-side intent classification (see AI-ARCHITECTURE-V2.md §2). Runs
 *  BEFORE any model call — a request never reaches the Writer's ~9k-token
 *  system prompt just to figure out "what is the user even asking for". Most
 *  cases are resolved by cheap heuristics on the raw chat text; only the
 *  genuinely ambiguous minority would fall through to a fast-model call (left
 *  as an explicit extension point below, not wired to Anthropic yet — the
 *  heuristics below cover v1's actual observed traffic patterns). */

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type MissingField = "service" | "pricing" | "sections";

export type Intent =
  | { kind: "revise" }
  | { kind: "tool_request" }
  | { kind: "needs_info"; missing: MissingField[] }
  | { kind: "new_draft" };

/** Content-library requests short-circuit straight to the Writer's tool loop
 *  (tools.ts already handles search_content_library etc.) — no need for the
 *  Planner to build a section plan first, the model drives this turn. */
const TOOL_REQUEST_PATTERN = /kütüphane(m(iz)?deki|den)|standart sözleşme|nda('|’)?(y|m)ı? ekle|standart (teklif|fiyat) (format|list)/i;

/** A handful of words is the classic "teklif yaz" / "bana bir teklif hazırla"
 *  weak prompt — v1 had to let the model discover this was underspecified
 *  mid-generation (and then ask one question at a time per KURALLAR); v2
 *  catches it before a single token is generated. */
const WEAK_PROMPT_WORD_COUNT = 6;

export function classifyIntent(messages: ChatMessage[], currentDraft: unknown): Intent {
  const last = [...messages].reverse().find((m) => m.role === "user");
  const lastText = last?.content.trim() ?? "";

  // An existing draft in flight → almost always a small, targeted edit
  // ("işçilik x2 olsun", "müşteri adını değiştir") — mirrors v1's DÜZENLEME
  // MODU branch (route.ts:649-651). Long free-form messages against an
  // existing draft can still legitimately restart planning (e.g. "aslında
  // baştan başlayalım"), so this only short-circuits on short messages.
  if (currentDraft && lastText.length > 0 && lastText.length < 200 && !TOOL_REQUEST_PATTERN.test(lastText)) {
    return { kind: "revise" };
  }

  if (TOOL_REQUEST_PATTERN.test(lastText)) {
    return { kind: "tool_request" };
  }

  // Only the FIRST message of a brand-new conversation can be a "weak
  // prompt" in the sense this guards against ("teklif yaz" with nothing
  // else). A short message on turn 2+ is far more likely to be the user
  // answering a Clarifier chip or narrowing an already-given brief (see the
  // identical messageCount<=1 gate in planner.ts's own Clarifier, added for
  // the same reason after this exact bug: treating every short later
  // message as underspecified would re-trigger needs_info forever on any
  // terse reply, since there's never a currentDraft yet at this stage).
  if (!currentDraft && messages.length <= 1) {
    const wordCount = lastText.split(/\s+/).filter(Boolean).length;
    if (wordCount > 0 && wordCount <= WEAK_PROMPT_WORD_COUNT) {
      return { kind: "needs_info", missing: ["service", "pricing"] };
    }
  }

  return { kind: "new_draft" };
}

/** Extension point for the genuinely-ambiguous minority (see module doc).
 *  Not called by classifyIntent yet — wire in once real traffic shows cases
 *  the heuristics above misclassify, per AI-ARCHITECTURE-V2.md §2's
 *  "belirsiz kalan azınlık durum" note. Kept here (rather than omitted) so
 *  the seam is explicit instead of silently missing. */
export async function classifyWithFastModel(_text: string, _hasDraft: boolean): Promise<Intent> {
  throw new Error("classifyWithFastModel: not wired yet — heuristics in classifyIntent should cover current traffic.");
}
