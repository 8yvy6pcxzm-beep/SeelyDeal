import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";

/** Company-scoped: real per-section total view time (seconds) for one proposal, aggregated across all viewers. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Bu özellik için giriş yapmalısın." }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 });

  const { data: proposal } = await service
    .from("proposals")
    .select("id, sections, company_id")
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .maybeSingle();
  if (!proposal) return NextResponse.json({ error: "Teklif bulunamadı." }, { status: 404 });

  const { data: views } = await service.from("proposal_views").select("id").eq("proposal_id", id);
  const viewIds = (views ?? []).map((v: { id: string }) => v.id);

  const totals: Record<number, number> = {};
  if (viewIds.length > 0) {
    const { data: rows } = await service
      .from("proposal_view_sections")
      .select("section_index, seconds")
      .in("view_id", viewIds);
    for (const r of rows ?? []) {
      totals[r.section_index] = (totals[r.section_index] ?? 0) + Number(r.seconds);
    }
  }

  const sections: { title: string; body: string }[] = proposal.sections ?? [];
  const sectionTimes = sections.map((s, i) => ({ title: s.title || `#${i + 1}`, seconds: totals[i] ?? 0 }));

  return NextResponse.json({ sectionTimes });
}
