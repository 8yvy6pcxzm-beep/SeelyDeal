import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Minimal fake of the Supabase query-builder chain sign/route.ts actually
 *  uses per table — not a general mock, just enough to drive the two code
 *  paths this test cares about (successful sign -> owner email lookup -> send). */
function builder(result: { data: unknown }) {
  const b: any = {
    select: () => b,
    eq: () => b,
    update: () => b,
    maybeSingle: async () => result,
    then: (resolve: (v: { data: unknown }) => void) => resolve(result),
  };
  return b;
}

function fakeService(opts: { existing: Record<string, unknown>; updateResult: Record<string, unknown>; ownerEmail: string | null }) {
  let proposalsCallCount = 0;
  return {
    from: vi.fn((table: string) => {
      if (table === "proposals") {
        proposalsCallCount++;
        return proposalsCallCount === 1 ? builder({ data: opts.existing }) : builder({ data: opts.updateResult });
      }
      if (table === "profiles") {
        return builder({ data: opts.ownerEmail ? { email: opts.ownerEmail } : null });
      }
      throw new Error(`unexpected table in test: ${table}`);
    }),
  };
}

const sendMock = vi.fn().mockResolvedValue({ data: { id: "email-1" }, error: null });

// A real class, not vi.fn().mockImplementation() — `new Resend(apiKey)` needs actual
// constructor semantics, and notifyOwnerOfSignature's try/catch would otherwise
// silently swallow a "not a constructor" error and make this look like a false pass.
vi.mock("resend", () => {
  class Resend {
    emails = { send: sendMock };
  }
  return { Resend };
});

let serviceForNextCall: ReturnType<typeof fakeService>;
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => serviceForNextCall,
}));

const baseExisting = {
  title: "Web Sitesi Teklifi",
  billing_options: [],
  line_items: [{ name: "Tasarım", qty: 1, unit: 25000 }],
  value: 25000,
  otp_code: null,
  otp_expires_at: null,
  otp_attempts: 0,
  created_by: "owner-1",
  companies: { plan: "lite", name: "Acme Ajans" },
  clients: { name: "Deneme Ltd" },
};

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/proposals/proposal-1/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.9" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/proposals/[id]/sign — imza e-posta bildirimi (Öncelik 2)", () => {
  const originalKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    sendMock.mockClear();
    process.env.RESEND_API_KEY = "test-resend-key";
  });

  afterEach(() => {
    process.env.RESEND_API_KEY = originalKey;
  });

  it("sends the owner a 'signed' email after a successful sign", async () => {
    serviceForNextCall = fakeService({
      existing: baseExisting,
      updateResult: { id: "proposal-1", payment_link: null },
      ownerEmail: "sahip@example.com",
    });

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ signedByName: "Test Müşteri" }), { params: Promise.resolve({ id: "proposal-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const sentArgs = sendMock.mock.calls[0][0];
    expect(sentArgs.to).toBe("sahip@example.com");
    expect(sentArgs.subject).toContain("Web Sitesi Teklifi");
    expect(sentArgs.text).toContain("Test Müşteri");
  });

  it("still signs successfully when the proposal has no owner (created_by null) — no email attempted", async () => {
    serviceForNextCall = fakeService({
      existing: { ...baseExisting, created_by: null },
      updateResult: { id: "proposal-1", payment_link: null },
      ownerEmail: null,
    });

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ signedByName: "Test Müşteri" }), { params: Promise.resolve({ id: "proposal-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("still signs successfully when RESEND_API_KEY is missing — email silently skipped", async () => {
    delete process.env.RESEND_API_KEY;
    serviceForNextCall = fakeService({
      existing: baseExisting,
      updateResult: { id: "proposal-1", payment_link: null },
      ownerEmail: "sahip@example.com",
    });

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ signedByName: "Test Müşteri" }), { params: Promise.resolve({ id: "proposal-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("still signs successfully even if Resend itself throws — email failure never blocks the client", async () => {
    sendMock.mockRejectedValueOnce(new Error("Resend is down"));
    serviceForNextCall = fakeService({
      existing: baseExisting,
      updateResult: { id: "proposal-1", payment_link: null },
      ownerEmail: "sahip@example.com",
    });

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ signedByName: "Test Müşteri" }), { params: Promise.resolve({ id: "proposal-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
  });

  it("rejects a sign attempt with no signer name before ever touching the DB", async () => {
    serviceForNextCall = fakeService({
      existing: baseExisting,
      updateResult: { id: "proposal-1", payment_link: null },
      ownerEmail: "sahip@example.com",
    });

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ signedByName: "  " }), { params: Promise.resolve({ id: "proposal-1" }) });

    expect(res.status).toBe(400);
    expect(serviceForNextCall.from).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });
});
