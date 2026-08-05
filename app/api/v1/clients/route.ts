import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { authenticateApiKey, apiAuthError } from "@/lib/api-key-auth";

/**
 * Public API — Custom-plan only. Part of "advanced API support": Pro's API key
 * works against /api/v1/proposals, but the clients endpoint (with rolled-up
 * proposal stats per client) is reserved for Custom.
 */
export async function GET(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return apiAuthError(auth);
  if (auth.plan !== "custom") return apiAuthError({ ok: false, reason: "plan_required", minPlan: "Custom" });

  const service = createServiceClient();
  const { data: clients, error } = await service
    .from("clients")
    .select("id, name, email, created_at, proposals(id, status, value)")
    .eq("company_id", auth.companyId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (clients ?? []).map((c: { id: string; name: string; email: string | null; created_at: string; proposals: unknown }) => {
    const proposals = (c.proposals as { id: string; status: string; value: number }[] | null) ?? [];
    const accepted = proposals.filter((p) => p.status === "accepted");
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      created_at: c.created_at,
      proposal_count: proposals.length,
      accepted_value: accepted.reduce((s, p) => s + (Number(p.value) || 0), 0),
    };
  });

  return NextResponse.json({ clients: rows });
}
