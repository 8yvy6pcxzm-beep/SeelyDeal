import type { ProposalDraft, Brand, Instruction, Format, AddClient, UserDefaultOut } from "./schema";

/** SSE event contract between the v2 Writer/route and the client — replaces
 *  the old single JSON response body (see AI-ARCHITECTURE-V2.md §6). Every
 *  event is a discriminated union member so the client can switch on `type`
 *  without guessing which optional fields are present. */
export type DraftEvent =
  | { type: "text"; delta: string }
  | { type: "clarify"; question: { tr: string; en: string }; chips: { key: string; label: { tr: string; en: string } }[]; multiSelect?: boolean }
  | { type: "draft"; draft: ProposalDraft }
  | { type: "brand"; payload: Brand }
  | { type: "instruction"; payload: Instruction }
  | { type: "format"; payload: Format }
  | { type: "addClient"; payload: AddClient }
  | { type: "userDefault"; payload: UserDefaultOut }
  | { type: "tool_call"; name: string }
  | { type: "done"; remaining: number }
  | { type: "error"; message: string };

/** Wraps an async generator of DraftEvents into a `text/event-stream`
 *  Response. One JSON object per SSE `data:` line — the client re-parses
 *  each line as a DraftEvent, never accumulates/re-parses a growing text
 *  blob the way the old regex approach had to (route.ts:719-855 in v1).
 *
 *  `gen` receives an AbortSignal that fires the moment the client disconnects
 *  (tab closed, "stop generating" button, network drop) — writer.ts threads
 *  it straight into `anthropic.messages.stream({ signal })` so a dropped
 *  client actually cancels the in-flight Anthropic call instead of letting
 *  it run to completion in the background on our dime (that gap existed
 *  until this fix: `cancel()` below used to be a no-op comment, so every
 *  disconnect kept burning tokens — and once produced, ai_usage.count for a
 *  request nobody would ever see). */
export function sseResponse(gen: (signal: AbortSignal) => AsyncGenerator<DraftEvent>): Response {
  const encoder = new TextEncoder();
  const abortController = new AbortController();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of gen(abortController.signal)) {
          controller.enqueue(encoder.encode(formatEvent(event)));
        }
      } catch (err) {
        if (abortController.signal.aborted) return; // client already gone — nothing to send
        const message = err instanceof Error ? err.message : "AI yanıt veremedi.";
        controller.enqueue(encoder.encode(formatEvent({ type: "error", message })));
      } finally {
        controller.close();
      }
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disables buffering on nginx-style reverse proxies so deltas actually
      // arrive incrementally instead of batching until the response ends.
      "X-Accel-Buffering": "no",
    },
  });
}

function formatEvent(event: DraftEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** Client-side helper (also exported for reuse by the useDraftStream hook in
 *  Adım 3) — parses one fetch() ReadableStream chunk buffer into zero or more
 *  complete DraftEvents plus any leftover partial line to prepend to the next
 *  chunk. SSE frames are separated by a blank line ("\n\n"), so a chunk can
 *  contain more than one event or end mid-event. */
export function parseSseChunk(buffer: string): { events: DraftEvent[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: DraftEvent[] = [];
  for (const part of parts) {
    const line = part.trim();
    if (!line.startsWith("data:")) continue;
    try {
      events.push(JSON.parse(line.slice(5).trim()) as DraftEvent);
    } catch {
      // Malformed frame (should not happen — we control both ends) — skip
      // rather than throw, so one bad frame doesn't kill the whole stream.
    }
  }
  return { events, rest };
}
