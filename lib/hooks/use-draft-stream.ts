import { useRef, useCallback } from "react";
import { parseSseChunk, type DraftEvent } from "@/app/api/draft-proposal/stream";
import type { ProposalDraft, Brand, Instruction, Format, AddClient, UserDefaultOut } from "@/app/api/draft-proposal/schema";
import type { ProposalBlock } from "@/lib/types/proposal-blocks";

/** Client-side reader for the v2 /api/draft-proposal SSE stream (see
 *  AI-ARCHITECTURE-V2.md §6). Exposes two things to a consuming component:
 *
 *  1. Live callbacks (`onTextDelta`, `onClarify`, `onToolCall`) — for
 *     anything that should update the UI incrementally as the stream runs.
 *  2. `send()` resolves to an AGGREGATE object shaped exactly like v1's old
 *     single JSON response (`{ reply, draft, brand, instruction, format,
 *     addClient, userDefault, remaining, clarify }`) — so existing
 *     downstream handling code (the ~250 lines in ai-draft-dialog.tsx that
 *     react to `data.brand`/`data.instruction`/... after a send) keeps
 *     working unchanged; only the transport underneath it changed. */

export type DraftStreamPayload = {
  messages: { role: "user" | "assistant"; content: string }[];
  websiteUrl?: string;
  attachments?: { name: string; mediaType: string; base64: string }[];
  currentDraft?: unknown;
  templateId?: string;
};

export type DraftStreamResult = {
  reply: string;
  draft:
    | (ProposalDraft & {
        blocks?: ProposalBlock[];
        themeJson?: { primaryColor: string; accentColor: string; font?: string };
        viewMode?: "pages" | "scroll";
      })
    | null;
  brand: Brand | null;
  instruction: Instruction | null;
  format: Format["value"] | null;
  addClient: AddClient | null;
  userDefault: UserDefaultOut | null;
  clarify: Extract<DraftEvent, { type: "clarify" }> | null;
  /** Chat-driven "İlk Tanışma Akışı" is no longer part of the Writer prompt
   *  (see prompts.ts — onboarding now happens on the /onboarding form
   *  wizard, per CLAUDE.md). Kept here, always null, only so the
   *  `data.onboarding?.completed` read in ai-draft-dialog.tsx keeps
   *  compiling — same dead-but-typed state v1 was already in. */
  onboarding: { completed?: boolean } | null;
  remaining: number;
};

export type DraftStreamCallbacks = {
  onTextDelta?: (delta: string) => void;
  onClarify?: (event: Extract<DraftEvent, { type: "clarify" }>) => void;
  onToolCall?: (name: string) => void;
  onDraft?: (draft: DraftStreamResult["draft"]) => void;
};

function emptyResult(): DraftStreamResult {
  return { reply: "", draft: null, brand: null, instruction: null, format: null, addClient: null, userDefault: null, clarify: null, onboarding: null, remaining: 0 };
}

export function useDraftStream() {
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async (payload: DraftStreamPayload, callbacks: DraftStreamCallbacks = {}): Promise<DraftStreamResult> => {
    const controller = new AbortController();
    abortRef.current = controller;

    const res = await fetch("/api/draft-proposal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    // Auth/quota/validation failures still come back as a single JSON body
    // (see route.ts's early `Response.json(...)` returns before sseResponse
    // takes over) — only a 2xx response is actually an SSE stream.
    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data.error || "Bir şeyler ters gitti.") as Error & {
        status?: number;
        overageLink?: string | null;
        overagePrice?: number;
        overageDrafts?: number;
      };
      err.status = res.status;
      err.overageLink = data.overageLink ?? null;
      err.overagePrice = data.overagePrice;
      err.overageDrafts = data.overageDrafts;
      throw err;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const result = emptyResult();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { events, rest } = parseSseChunk(buffer);
      buffer = rest;

      for (const event of events) {
        switch (event.type) {
          case "text":
            result.reply += event.delta;
            callbacks.onTextDelta?.(event.delta);
            break;
          case "clarify":
            result.clarify = event;
            callbacks.onClarify?.(event);
            break;
          case "draft":
            result.draft = event.draft as DraftStreamResult["draft"];
            callbacks.onDraft?.(result.draft);
            break;
          case "brand":
            result.brand = event.payload;
            break;
          case "instruction":
            result.instruction = event.payload;
            break;
          case "format":
            result.format = event.payload.value;
            break;
          case "addClient":
            result.addClient = event.payload;
            break;
          case "userDefault":
            result.userDefault = event.payload;
            break;
          case "tool_call":
            callbacks.onToolCall?.(event.name);
            break;
          case "done":
            result.remaining = event.remaining;
            break;
          case "error":
            throw new Error(event.message);
        }
      }
    }

    return result;
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { send, stop };
}
