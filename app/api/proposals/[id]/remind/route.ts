import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";
import appConfig from "@/app.config";

/** Sends a "you haven't signed yet" nudge email to the client on an already-sent proposal. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profili bulunamadı." }, { status: 404 });

  const { data: proposal } = await service
    .from("proposals")
    .select("id, title, status, value, companies(name), clients(name, email)")
    .eq("id", id)
    .eq("company_id", profile.company_id)
    .maybeSingle();

  if (!proposal) return NextResponse.json({ error: "Teklif bulunamadı." }, { status: 404 });
  if (proposal.status === "draft") return NextResponse.json({ error: "Bu teklif henüz gönderilmedi." }, { status: 400 });
  if (proposal.status === "accepted" || proposal.status === "declined") {
    return NextResponse.json({ error: "Bu teklif zaten karara bağlandı." }, { status: 400 });
  }

  const client = proposal.clients as { name: string; email: string | null } | null;
  if (!client?.email) return NextResponse.json({ error: "Müşterinin kayıtlı email adresi yok." }, { status: 400 });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Email gönderme servisi yapılandırılmamış." }, { status: 502 });

  const companyName = (proposal.companies as { name: string } | null)?.name ?? appConfig.name;
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const link = `${siteUrl}/p/${proposal.id}`;

  const resend = new Resend(apiKey);
  const { error: sendError } = await resend.emails.send({
    from: `${appConfig.name} <elif@seelynow.info>`,
    to: client.email,
    subject: `${companyName} — "${proposal.title}" teklifin bekliyor`,
    text: `Merhaba ${client.name || ""},\n\n${companyName} sana "${proposal.title}" için bir teklif gönderdi ve henüz imzalanmadı.\n\nTeklifi incelemek ve imzalamak için: ${link}\n\nBu bir hatırlatma emailidir.`,
  });

  if (sendError) return NextResponse.json({ error: "Email gönderilemedi." }, { status: 502 });

  return NextResponse.json({ ok: true });
}
