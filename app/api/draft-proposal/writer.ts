import Anthropic from "@anthropic-ai/sdk";
import type { createServiceClient as CreateServiceClient } from "@/lib/supabase/server";
import type { ProposalBlock } from "@/lib/types/proposal-blocks";
import { legacyToBlocks } from "@/lib/proposal-blocks/convert-legacy";
import { pseudoTools, type PseudoToolName } from "./schema";
import { contentLibraryTools, contentLibraryToolNames, runContentLibraryTool } from "./tools";
import type { DraftEvent } from "./stream";

const MODEL = "claude-sonnet-5";

type ChatMessage = { role: "user" | "assistant"; content: string };
type Attachment = { name: string; mediaType: string; base64: string };

const allTools = [...contentLibraryTools, ...Object.values(pseudoTools).map((p) => p.tool)];

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
        tools: allTools,
      },
      { signal: opts.signal },
    );

    // Text deltas go straight to the client as they're generated — this is
    // the actual latency win over v1's `messages.create` (blocks until the
    // full response, including any trailing json/brand/... fences, is done).
    const textChunks: string[] = [];
    const finalMessage = await new Promise<Anthropic.Message>((resolve, reject) => {
      stream.on("text", (delta) => textChunks.push(delta));
      stream.on("message", (msg) => resolve(msg));
      stream.on("error", (err) => reject(err));
    });

    // Emit text deltas in order now that we have them — for a true
    // char-by-char UI feel, swap this loop for yielding inside the "text"
    // listener via an async queue (left as a follow-up; the SSE contract in
    // stream.ts already supports it, this is a streaming-transport detail).
    for (const delta of textChunks) {
      if (delta) yield { type: "text", delta };
    }

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
          const baseBlocks: ProposalBlock[] = legacyToBlocks(draft);
          const templateBlocks = opts.resolvedTemplateBlocks ?? [];
          if (templateBlocks.length > 0 || pendingContentBlocks.length > 0 || pendingLegalBlocks.length > 0) {
            draft.blocks = [...baseBlocks, ...templateBlocks, ...pendingContentBlocks, ...pendingLegalBlocks];
          }
          if (opts.themeJson) draft.themeJson = { ...(draft.themeJson as Record<string, unknown> | undefined), ...opts.themeJson };
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
