import Anthropic from "@anthropic-ai/sdk";
import type { createServiceClient as CreateServiceClient } from "@/lib/supabase/server";
import type { ProposalBlock } from "@/lib/types/proposal-blocks";
import { legacyToBlocks } from "@/lib/proposal-blocks/convert-legacy";
import { pseudoTools, type PseudoToolName } from "./schema";
import { contentLibraryTools, contentLibraryToolNames, runContentLibraryTool } from "./tools";
import type { DraftEvent } from "./stream";
import { planAllows } from "@/lib/plan";

const MODEL = "claude-sonnet-5";

type ChatMessage = { role: "user" | "assistant"; content: string };
type Attachment = { name: string; mediaType: string; base64: string };

const pseudoToolList = Object.values(pseudoTools).map((p) => p.tool);

/** Content Library tools are Pro+ (document_library gate) — dropped from the
 *  list offered to the model on Lite so it never attempts (and gets blocked
 *  by runContentLibraryTool's own check) a call it has no access to. */
function toolsForPlan(plan: "lite" | "pro" | "custom") {
  return planAllows(plan, "document_library") ? [...contentLibraryTools, ...pseudoToolList] : pseudoToolList;
}

function toAnthropicMessages(messages: ChatMessage[], attachments?: Attachment[]) {
  return messages.map((m, i) => {
    const isLastUserMessage = i === messages.length - 1 && m.role === "user";
    if (isLastUserMessage && attachments && attachments.length > 0) {
      const blocks = attachments.map((a) =>
        a.mediaType === "application/pdf"
          ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: a.base64 } }
          : { type: "image" as const, source: { type: "base64" as const, media_type: a.mediaType as any, data: a.base64 } },
      );
      return { role: m.role, content: [...blocks, { type: "text" as const, text: m.content }] };
    }
    return { role: m.role, content: m.content };
  });
}

/** Runs the Writer turn: streams chat text as it's generated, and turns any
 *  pseudo-tool call (emit_draft/set_brand/...) or real content-library tool
 *  call into DraftEvents. Up to 4 rounds — same ceiling as v1 (route.ts:692),
 *  kept so a stuck tool loop can't run away with API calls.
 *
 *  `resolvedTemplateBlocks` are a resolved company template's own saved
 *  blocks (see v1 route.ts:748 `templateBlocks`) — merged into the final
 *  `draft.blocks` alongside whatever the tools produced this turn. */
export async function* streamDraft(opts: {
  systemPrompt: string;
  messages: ChatMessage[];
  attachments?: Attachment[];
  service: ReturnType<typeof CreateServiceClient>;
  companyId: string;
  /** Content Library tools (search_content_library etc.) are gated to Pro+ —
   *  same "document_library" feature the UI (app/(app)/content/page.tsx) already
   *  enforces — see runContentLibraryTool's own check below for why this can't
   *  live only in the UI. */
  plan: "lite" | "pro" | "custom";
  resolvedTemplateBlocks?: ProposalBlock[];
  themeJson?: Record<string, unknown>;
  /** Fires when the client disconnects (tab closed, stop button, network
   *  drop) — threaded straight into the Anthropic call below so a dropped
   *  client actually cancels the in-flight request instead of burning
   *  tokens (and, if it happens to land on a `confirmed:true` turn, writing
   *  a proposal) for a response nobody will ever read. See stream.ts. */
  signal?: AbortSignal;
}): AsyncGenerator<DraftEvent> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const pendingLegalBlocks: ProposalBlock[] = [];
  const pendingContentBlocks: ProposalBlock[] = [];
  let loopMessages = toAnthropicMessages(opts.messages, opts.attachments) as any[];

  for (let round = 0; round < 4; round++) {
    if (opts.signal?.aborted) return;
    const stream = anthropic.messages.stream(
      {
        model: MODEL,
        max_tokens: 8192,
        system: opts.systemPrompt,
        messages: loopMessages,
        tools: toolsForPlan(opts.plan),
      },
      { signal: opts.signal },
    );

    // Text deltas go straight to the client AS Anthropic emits them — this is
    // the actual latency win over v1's `messages.create` (blocks until the
    // full response is done). Previously this loop buffered every delta into
    // an array and only yielded them after `stream.on("message")` fired,
    // i.e. after the ENTIRE turn had finished generating — for a long
    // proposal that's 20-60s+ with zero bytes going out over the SSE
    // connection. Mobile networks (and some proxies) silently drop an HTTP
    // connection that idle that long, which surfaced to users as a generic
    // "Connection error" mid-generation. Iterating the stream's own raw
    // events yields each delta the moment it arrives instead.
    for await (const streamEvent of stream) {
      if (streamEvent.type === "content_block_delta" && streamEvent.delta.type === "text_delta") {
        yield { type: "text", delta: streamEvent.delta.text };
      }
    }
    const finalMessage = await stream.finalMessage();

    if (finalMessage.stop_reason !== "tool_use") {
      return;
    }

    const toolUses = finalMessage.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    const toolResults = await Promise.all(
      toolUses.map(async (tu) => {
        if (contentLibraryToolNames.has(tu.name)) {
          // tool_call events can't be yielded from inside Promise.all (a
          // generator can only yield from its own `for await` body), so
          // they're emitted in the loop below, once each result resolves.
          const content = await runContentLibraryTool(
            tu.name,
            (tu.input as Record<string, unknown>) ?? {},
            opts.service,
            opts.companyId,
            opts.plan,
            pendingLegalBlocks,
            pendingContentBlocks,
          );
          return { tu, content };
        }

        const name = tu.name as PseudoToolName;
        if (name === "emit_draft") {
          const parsed = pseudoTools.emit_draft.schema.safeParse(tu.input ?? {});
          if (!parsed.success) return { tu, content: JSON.stringify({ error: "Şema doğrulanamadı.", issues: parsed.error.issues }) };
          const draft: Record<string, unknown> = { ...parsed.data };
          if (opts.themeJson) draft.themeJson = { ...(draft.themeJson as Record<string, unknown> | undefined), ...opts.themeJson };
          // Blocks are NOT merged here — pendingLegalBlocks/pendingContentBlocks may
          // still be empty at this exact point even though a sibling tool_use in this
          // SAME batch (e.g. add_legal_block_to_proposal) will fill them in a moment.
          // Promise.all runs every tool_use concurrently; this branch has no `await`
          // so it can finish synchronously before that sibling's DB round-trip does.
          // The merge happens once below, after ALL of toolResults has settled.
          return { tu, content: JSON.stringify({ ok: true }), event: { type: "draft", draft } as DraftEvent };
        }
        if (name === "set_brand") {
          const parsed = pseudoTools.set_brand.schema.safeParse(tu.input ?? {});
          if (!parsed.success) return { tu, content: JSON.stringify({ error: "Şema doğrulanamadı." }) };
          return { tu, content: JSON.stringify({ ok: true }), event: { type: "brand", payload: parsed.data } as DraftEvent };
        }
        if (name === "set_instruction") {
          const parsed = pseudoTools.set_instruction.schema.safeParse(tu.input ?? {});
          if (!parsed.success) return { tu, content: JSON.stringify({ error: "Şema doğrulanamadı." }) };
          return { tu, content: JSON.stringify({ ok: true }), event: { type: "instruction", payload: parsed.data } as DraftEvent };
        }
        if (name === "set_format") {
          const parsed = pseudoTools.set_format.schema.safeParse(tu.input ?? {});
          if (!parsed.success) return { tu, content: JSON.stringify({ error: "Şema doğrulanamadı." }) };
          return { tu, content: JSON.stringify({ ok: true }), event: { type: "format", payload: parsed.data } as DraftEvent };
        }
        if (name === "add_client") {
          const parsed = pseudoTools.add_client.schema.safeParse(tu.input ?? {});
          if (!parsed.success) return { tu, content: JSON.stringify({ error: "Şema doğrulanamadı." }) };
          return { tu, content: JSON.stringify({ ok: true }), event: { type: "addClient", payload: parsed.data } as DraftEvent };
        }
        if (name === "save_user_default") {
          const parsed = pseudoTools.save_user_default.schema.safeParse(tu.input ?? {});
          if (!parsed.success) return { tu, content: JSON.stringify({ error: "Şema doğrulanamadı." }) };
          return { tu, content: JSON.stringify({ ok: true }), event: { type: "userDefault", payload: parsed.data } as DraftEvent };
        }

        return { tu, content: JSON.stringify({ error: "Bilinmeyen araç." }) };
      }),
    );

    // Now that every tool_use in this batch has fully settled (including any async
    // content-library DB round-trips), pendingLegalBlocks/pendingContentBlocks hold
    // everything this turn produced — safe to merge into any `draft` event now.
    const templateBlocks = opts.resolvedTemplateBlocks ?? [];
    if (templateBlocks.length > 0 || pendingContentBlocks.length > 0 || pendingLegalBlocks.length > 0) {
      for (const result of toolResults) {
        if ("event" in result && result.event?.type === "draft") {
          const draft = result.event.draft as Record<string, unknown>;
          const baseBlocks: ProposalBlock[] = Array.isArray(draft.blocks) ? (draft.blocks as ProposalBlock[]) : legacyToBlocks(draft);
          draft.blocks = [...baseBlocks, ...templateBlocks, ...pendingContentBlocks, ...pendingLegalBlocks];
        }
      }
    }

    for (const result of toolResults) {
      yield { type: "tool_call", name: result.tu.name };
      if ("event" in result && result.event) yield result.event;
    }

    loopMessages = [
      ...loopMessages,
      { role: "assistant", content: finalMessage.content },
      { role: "user", content: toolResults.map((r) => ({ type: "tool_result" as const, tool_use_id: r.tu.id, content: r.content })) },
    ];
  }
}
