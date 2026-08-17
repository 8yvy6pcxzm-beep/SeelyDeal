import { describe, expect, it } from "vitest";
import { getVisualTemplates, getDraftTemplates, templates } from "./data";

describe("getVisualTemplates / getDraftTemplates", () => {
  it("splits every template into exactly one of the two groups", () => {
    const visual = getVisualTemplates();
    const draft = getDraftTemplates();
    expect(visual.length + draft.length).toBe(templates.length);
    const overlap = visual.filter((v) => draft.some((d) => d.id === v.id));
    expect(overlap).toHaveLength(0);
  });

  it("getVisualTemplates only returns templates with kind unset", () => {
    for (const t of getVisualTemplates()) expect(t.kind).toBeUndefined();
  });

  it("getDraftTemplates only returns templates with kind: \"draft\"", () => {
    for (const t of getDraftTemplates()) expect(t.kind).toBe("draft");
  });

  it("includes the known visual skeletons t1–t4", () => {
    const ids = getVisualTemplates().map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(["t1", "t2", "t3", "t4"]));
  });

  it("includes the known construction draft example t5", () => {
    const t5 = getDraftTemplates().find((t) => t.id === "t5");
    expect(t5?.sector).toBe("construction");
    expect(t5?.introText?.tr).toBeTruthy();
  });
});
