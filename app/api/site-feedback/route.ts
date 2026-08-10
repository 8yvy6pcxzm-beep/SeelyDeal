import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";
import appConfig from "@/app.config";

/** Complaints/feedback the seelynow.com widget (Seely) picks up mid-chat — not client-scoped,
 *  so only the vendor's own account can list them. Public POST (widget has no auth). */
export async function GET(req: Request) {
  const user = await getAuthedUser(req);
  if (!user || user.email !== appConfig.contactEmail) {
    return NextResponse.json({ error: "Yetkin yok." }, { status: 403 });
  }

  const service = createServiceClient();
  const { data: feedback, error } = await service.from("site_feedback").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ feedback: feedback ?? [] });
}

export async function POST(req: Request) {
  const { message, contact } = (await req.json()) as { message?: string; contact?: string };
  if (!message?.trim()) {
    return NextResponse.json({ error: "Mesaj boş olamaz." }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service.from("site_feedback").insert({
    message: message.trim(),
    contact: contact?.trim() || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
