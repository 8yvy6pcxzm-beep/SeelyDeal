import { describe, expect, it, vi } from "vitest";
import { runContentLibraryTool } from "./tools";
import type { ProposalBlock } from "@/lib/types/proposal-blocks";

/** Minimal fake of the Supabase query-builder chain this file actually uses
 *  (.select().eq().eq().maybeSingle(), or just awaiting after .eq() for a
 *  plain list query) — not a general Supabase mock, just enough surface for
 *  tools.ts's own calls. */
function fakeQueryBuilder(result: { data: unknown; error?: unknown }) {
  const builder: PromiseLike<{ data: unknown; error?: unknown }> & {
    select: () => typeof builder;
    eq: () => typeof builder;
    insert: () => typeof builder;
    single: () => Promise<{ data: unknown; error?: unknown }>;
    maybeSingle: () => Promise<{ data: unknown; error?: unknown }>;
  } = {
    select: () => builder,
    eq: () => builder,
    insert: () => builder,
    single: async () => result,
    maybeSingle: async () => result,
    then: (resolve: (value: { data: unknown; error?: unknown }) => void) => resolve(result),
  } as any;
  return builder;
}

function fakeService(result: { data: unknown; error?: unknown }) {
  return { from: vi.fn(() => fakeQueryBuilder(result)) } as any;
}

describe("runContentLibraryTool — plan gating (Öncelik 1)", () => {
  const gatedTools = [
    "search_content_library",
    "add_legal_block_to_proposal",
    "add_text_block_from_library",
    "save_to_content_library",
  ] as const;

  for (const name of gatedTools) {
    it(`blocks "${name}" on Lite without ever touching the DB`, async () => {
      const service = fakeService({ data: [] });
      const result = await runContentLibraryTool(name, { documentId: "doc-1" }, service, "company-1", "lite", [], []);
      const parsed = JSON.parse(result);
      expect(parsed.error).toBeTruthy();
      expect(service.from).not.toHaveBeenCalled();
    });
  }

  it("allows search_content_library on Pro and returns library rows", async () => {
    const rows = [{ id: "doc-1", type: "contract", title: "NDA", content: "gizlilik metni" }];
    const service = fakeService({ data: rows });
    const result = await runContentLibraryTool("search_content_library", {}, service, "company-1", "pro", [], []);
    const parsed = JSON.parse(result);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe("NDA");
  });

  it("allows add_legal_block_to_proposal on Custom and pushes a deep-copied Legal block", async () => {
    const doc = { id: "doc-1", title: "NDA", content: "gizlilik metni" };
    const service = fakeService({ data: doc });
    const pendingLegalBlocks: ProposalBlock[] = [];
    const result = await runContentLibraryTool(
      "add_legal_block_to_proposal",
      { documentId: "doc-1", requireSignature: true },
      service,
      "company-1",
      "custom",
      pendingLegalBlocks,
      [],
    );
    expect(JSON.parse(result).ok).toBe(true);
    expect(pendingLegalBlocks).toHaveLength(1);
    expect(pendingLegalBlocks[0]).toMatchObject({
      type: "Legal",
      title: "NDA",
      content: "gizlilik metni",
      sourceDocumentId: "doc-1",
      settings: { requireSignature: true },
    });
  });
});

describe("runContentLibraryTool — save_to_content_library (chatbot -> library write)", () => {
  it("inserts a new company_documents row and returns its id/title/type", async () => {
    const inserted = { id: "doc-new", type: "content_block", title: "Ekip Tanıtımı" };
    const service = fakeService({ data: inserted });
    const result = await runContentLibraryTool(
      "save_to_content_library",
      { title: "Ekip Tanıtımı", content: "Ekibimiz 10 yıllık deneyime sahiptir." },
      service,
      "company-1",
      "pro",
      [],
      [],
    );
    const parsed = JSON.parse(result);
    expect(parsed).toMatchObject({ ok: true, id: "doc-new", title: "Ekip Tanıtımı", type: "content_block" });
    expect(service.from).toHaveBeenCalledWith("company_documents");
  });

  it("defaults to type 'content_block' when no type given, and respects an explicit one", async () => {
    const service = fakeService({ data: { id: "doc-2", type: "reference", title: "Vaka Çalışması" } });
    const result = await runContentLibraryTool(
      "save_to_content_library",
      { title: "Vaka Çalışması", content: "Geçmiş bir proje özeti.", type: "reference" },
      service,
      "company-1",
      "custom",
      [],
      [],
    );
    expect(JSON.parse(result).type).toBe("reference");
  });

  it("rejects empty content", async () => {
    const service = fakeService({ data: null });
    const result = await runContentLibraryTool(
      "save_to_content_library",
      { title: "Boş", content: "   " },
      service,
      "company-1",
      "pro",
      [],
      [],
    );
    expect(JSON.parse(result).error).toBeTruthy();
    expect(service.from).not.toHaveBeenCalled();
  });

  it("is blocked on Lite without touching the DB", async () => {
    const service = fakeService({ data: null });
    const result = await runContentLibraryTool(
      "save_to_content_library",
      { title: "X", content: "Y" },
      service,
      "company-1",
      "lite",
      [],
      [],
    );
    expect(JSON.parse(result).error).toBeTruthy();
    expect(service.from).not.toHaveBeenCalled();
  });
});

describe("runContentLibraryTool — generate_custom_text_block is NOT plan-gated", () => {
  it("works on Lite (never touches company_documents)", async () => {
    const service = fakeService({ data: [] });
    const pendingLegalBlocks: ProposalBlock[] = [];
    const result = await runContentLibraryTool(
      "generate_custom_text_block",
      { blockType: "legal", title: "Gizlilik Maddesi", content: "Taraflar bilgiyi gizli tutar.", requireSignature: true },
      service,
      "company-1",
      "lite",
      pendingLegalBlocks,
      [],
    );
    expect(JSON.parse(result).ok).toBe(true);
    expect(service.from).not.toHaveBeenCalled();
    expect(pendingLegalBlocks).toHaveLength(1);
    expect(pendingLegalBlocks[0]).toMatchObject({
      type: "Legal",
      title: "Gizlilik Maddesi",
      content: "Taraflar bilgiyi gizli tutar.",
      settings: { requireSignature: true },
    });
  });

  it("rejects empty content regardless of plan", async () => {
    const service = fakeService({ data: [] });
    const result = await runContentLibraryTool(
      "generate_custom_text_block",
      { blockType: "text", title: "Boş", content: "  " },
      service,
      "company-1",
      "custom",
      [],
      [],
    );
    expect(JSON.parse(result).error).toBeTruthy();
  });
});
