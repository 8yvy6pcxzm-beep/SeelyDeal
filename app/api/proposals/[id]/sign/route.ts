import { NextResponse } from "next/server";
import crypto from "crypto";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/server";
import appConfig from "@/app.config";

/** Public e-sign action: marks the proposal accepted and hands back the agency's payment link. */
type BillingOption = { key: string; label: { tr: string; en: string }; price: number; paymentLink?: string };
type LineItem = { name: string; qty: number; unit: number; optional?: boolean; included?: boolean };

const MAX_OTP_ATTEMPTS = 5;

function codesMatch(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const billingKey: string | undefined = body?.billingKey;
  const lineItems: LineItem[] | undefined = body?.lineItems;
  const signedByName: string | undefined = body?.signedByName;
  const otpCode: string | undefined = body?.otpCode;

  if (!signedByName?.trim()) {
    return NextResponse.json({ error: "İmzalamak için adını yazman gerekiyor." }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
  const userAgent = req.headers.get("user-agent") || null;

  const service = createServiceClient();

  const { data: existing } = await service
    .from("proposals")
    .select(
      "title, billing_options, line_items, value, otp_code, otp_expires_at, otp_attempts, created_by, companies(plan, name), clients(name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: "Teklif bulunamadı." }, { status: 404 });

  const plan = (existing.companies as { plan: string } | null)?.plan ?? "lite";
  if (plan !== "lite") {
    const attempts = existing.otp_attempts ?? 0;
    if (attempts >= MAX_OTP_ATTEMPTS) {
      return NextResponse.json({ error: "Çok fazla hatalı deneme. Yeni bir kod iste." }, { status: 429 });
    }

    const expired = !existing.otp_expires_at || new Date(existing.otp_expires_at) < new Date();
    const valid = !!otpCode?.trim() && !!existing.otp_code && !expired && codesMatch(otpCode.trim(), existing.otp_code);
    if (!valid) {
      await service.from("proposals").update({ otp_attempts: attempts + 1 }).eq("id", id);
      return NextResponse.json({ error: "Kod hatalı veya süresi dolmuş." }, { status: 400 });
    }
  }

  const options: BillingOption[] = existing.billing_options ?? [];
  const chosen = billingKey ? options.find((o) => o.key === billingKey) : undefined;

  const finalItems: LineItem[] = lineItems ?? existing.line_items ?? [];
  const itemsTotal = finalItems.reduce((s, li) => (li.optional && !li.included ? s : s + li.qty * li.unit), 0);

  const patch: Record<string, unknown> = {
    status: "accepted",
    signed_at: new Date().toISOString(),
    signed_by_name: signedByName.trim(),
    signed_ip: ip,
    signed_user_agent: userAgent,
    line_items: finalItems,
    value: itemsTotal + (chosen?.price ?? 0) || existing.value,
  };
  if (chosen) patch.selected_billing = chosen.key;
  if (plan !== "lite") {
    patch.otp_code = null;
    patch.otp_expires_at = null;
  }

  const { data: proposal, error } = await service
    .from("proposals")
    .update(patch)
    .eq("id", id)
    .select("id, payment_link")
    .maybeSingle();

  if (error || !proposal) return NextResponse.json({ error: "Teklif bulunamadı." }, { status: 404 });

  await notifyOwnerOfSignature(service, {
    proposalId: id,
    title: existing.title,
    signedByName: signedByName.trim(),
    companyName: (existing.companies as { name: string } | null)?.name,
    clientName: (existing.clients as { name: string } | null)?.name,
    ownerId: existing.created_by as string | null,
  });

  return NextResponse.json({ ok: true, paymentLink: chosen?.paymentLink || proposal.payment_link || null });
}

/** Best-effort "your proposal was just signed" email to the proposal's owner —
 *  never blocks or fails the client's accept flow (no RESEND_API_KEY, no
 *  owner email, or a Resend error all just get swallowed). */
async function notifyOwnerOfSignature(
  service: ReturnType<typeof createServiceClient>,
  info: { proposalId: string; title: string; signedByName: string; companyName?: string; clientName?: string; ownerId: string | null },
) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !info.ownerId) return;

  const { data: owner } = await service.from("profiles").select("email").eq("id", info.ownerId).maybeSingle();
  if (!owner?.email) return;

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const link = `${siteUrl}/proposals/${info.proposalId}`;
  const companyName = info.companyName ?? appConfig.name;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: `${appConfig.name} <elif@seelynow.info>`,
      to: owner.email,
      subject: `"${info.title}" imzalandı 🎉`,
      text: `Merhaba,\n\n${info.clientName || "Müşterin"} (${info.signedByName}) ${companyName} adına gönderdiğin "${info.title}" teklifini imzaladı.\n\nTeklifi görüntülemek için: ${link}`,
    });
  } catch {
    // best-effort — signature already recorded, don't fail the client's request over an email hiccup
  }
}
