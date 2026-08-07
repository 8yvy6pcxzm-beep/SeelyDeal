import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/** Public, unauthenticated read of a single proposal — only the fields a client needs to view and sign. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const service = createServiceClient();
  const { data: proposal } = await service
    .from("proposals")
    .select(
      "id, company_id, title, status, value, sections, line_items, contract_text, signed_at, signed_by_name, billing_options, selected_billing, intro_text, about_text, client_contact, next_steps, valid_days, created_at, theme_json, clients(name), companies(name, logo_url, cover_image_url, primary_color, email, plan)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!proposal) return NextResponse.json({ error: "Teklif bulunamadı." }, { status: 404 });

  // Real team photos, pulled live from the company's roster — not something the AI writes into the
  // section body, so it can't hallucinate a wrong image. Only shown for members who have a photo.
  const { data: team } = await service
    .from("team_members")
    .select("name, title, photo_url")
    .eq("company_id", proposal.company_id)
    .not("photo_url", "is", null);
  (proposal as unknown as { team: typeof team }).team = team ?? [];

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
  const userAgent = req.headers.get("user-agent") || null;
  const { data: view } = await service
    .from("proposal_views")
    .insert({ proposal_id: id, ip, user_agent: userAgent })
    .select("id")
    .single();

  if (proposal.status === "sent") {
    await service.from("proposals").update({ status: "viewed" }).eq("id", id);
    proposal.status = "viewed";
  }

  return NextResponse.json({ proposal, viewId: view?.id ?? null });
}
