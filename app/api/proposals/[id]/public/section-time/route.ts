import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/** Public, unauthenticated: records how long an anonymous viewer spent on each proposal section. */
export async function POST(req: Request) {
  const { viewId, sections } = (await req.json()) as {
    viewId?: string;
    sections?: { index: number; seconds: number }[];
  };

  if (!viewId || !Array.isArray(sections) || sections.length === 0) {
    return NextResponse.json({ error: "viewId/sections eksik." }, { status: 400 });
  }

  const rows = sections
    .filter((s) => Number.isInteger(s.index) && s.seconds > 0)
    .map((s) => ({ view_id: viewId, section_index: s.index, seconds: s.seconds }));

  if (rows.length === 0) return NextResponse.json({ ok: true });

  const service = createServiceClient();
  const { error } = await service.from("proposal_view_sections").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
