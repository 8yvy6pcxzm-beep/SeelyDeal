import { describe, expect, it } from "vitest";
import { planAllows } from "./plan";

describe("planAllows", () => {
  it("blocks a Pro+ feature on Lite", () => {
    expect(planAllows("lite", "document_library")).toBe(false);
    expect(planAllows("lite", "templates_create")).toBe(false);
    expect(planAllows("lite", "signatures")).toBe(false);
  });

  it("allows a Pro+ feature on Pro and Custom", () => {
    expect(planAllows("pro", "document_library")).toBe(true);
    expect(planAllows("custom", "document_library")).toBe(true);
  });

  it("blocks a Custom-only feature on Pro", () => {
    expect(planAllows("pro", "sso")).toBe(false);
    expect(planAllows("pro", "accounting_integrations")).toBe(false);
    expect(planAllows("custom", "sso")).toBe(true);
  });

  it("treats a null/undefined plan as Lite", () => {
    expect(planAllows(null, "document_library")).toBe(false);
    expect(planAllows(undefined, "document_library")).toBe(false);
  });
});
