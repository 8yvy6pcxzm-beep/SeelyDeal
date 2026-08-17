import { describe, expect, it } from "vitest";
import { resolvedTemplateBlock } from "./prompts";
import type { ResolvedTemplate } from "./context";

/** Regression test for the bug fixed alongside VisualTemplateCard/getDraftTemplates
 *  (see TEMPLATE-ARCHITECTURE.md): a demo "draft example" template (kind: "draft",
 *  e.g. the sector chips in ai-draft-dialog.tsx) was being treated as a pure
 *  visual skeleton — resolvedTemplateBlock branched on `source` alone, so its
 *  real introText/sections/lineItems never reached the AI. It now also checks
 *  `isDraftExample`. */
describe("resolvedTemplateBlock", () => {
  function template(overrides: Partial<ResolvedTemplate>): ResolvedTemplate {
    return {
      name: "İnşaat",
      introText: "Sayın Ahmet Yılmaz, ...",
      aboutText: "Yirmi yılı aşkın süredir ...",
      sections: [{ title: "Kapsam", body: "..." }],
      lineItems: [],
      contractText: "...",
      source: "demo",
      isDraftExample: false,
      ...overrides,
    };
  }

  it("uses real content for a demo draft example (kind: \"draft\")", () => {
    const block = resolvedTemplateBlock(template({ isDraftExample: true }));
    expect(block).toContain("İÇERİĞİNİ DE kullan");
    expect(block).toContain("Sayın Ahmet Yılmaz");
    expect(block).not.toContain("SADECE GÖRSELDİR");
  });

  it("uses real content for a company's own saved template", () => {
    const block = resolvedTemplateBlock(template({ source: "company", isDraftExample: false }));
    expect(block).toContain("İÇERİĞİNİ DE kullan");
    expect(block).not.toContain("SADECE GÖRSELDİR");
  });

  it("withholds section text for a pure visual demo skeleton (kind unset)", () => {
    const block = resolvedTemplateBlock(template({ source: "demo", isDraftExample: false }));
    expect(block).toContain("SADECE GÖRSELDİR");
    expect(block).not.toContain("Sayın Ahmet Yılmaz");
  });

  it("returns empty string when nothing was resolved", () => {
    expect(resolvedTemplateBlock(undefined)).toBe("");
  });
});
