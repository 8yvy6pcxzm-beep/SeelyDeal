import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";
import { isSeelyDealPricingLeak } from "@/lib/seelydeal-pricing-leak";

const TITLE = "Hizmetler ve Fiyatlandırma";

/** Upserts the onboarding-collected services/pricing summary as a `service_description`
 * row in company_documents (see Company Profile → "Varsayılan içerik") — this is the
 * same doc type/library a company can also edit by hand, so it shows up as a normal
 * document there and feeds every future proposal draft via the VARSAYILAN İÇERİK block
 * in app/api/draft-proposal/route.ts. One canonical row per company; re-running
 * onboarding (or the AI re-confirming this info) updates it instead of duplicating it. */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const { content } = (await req.json()) as { content?: string };
  if (!content?.trim()) return NextResponse.json({ error: "İçerik boş olamaz." }, { status: 400 });

  // The AI drafting chat has repeatedly mistaken SeelyDeal's own Lite/Pro/Custom
  // subscription pricing (e.g. after a user mentions "custom paketim") for the
  // company's own service/pricing summary and auto-saved it here — see
  // lib/seelydeal-pricing-leak.ts. Reject it at the source so it can't be persisted
  // again, whether it comes from that auto-save or a manual paste.
  if (isSeelyDealPricingLeak(content)) {
    return NextResponse.json(
      { error: "Bu içerik SeelyDeal'ın kendi paket fiyatlarıyla eşleşiyor gibi görünüyor — bu, sizin kendi hizmet/fiyatlandırmanız olmayabilir. Lütfen kendi hizmetlerinizi ve fiyatlarınızı girin." },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 });

  const { data: existing } = await service
    .from("company_documents")
    .select("id")
    .eq("company_id", profile.company_id)
    .eq("type", "service_description")
    .eq("title", TITLE)
    .maybeSingle();

  const { error } = existing
    ? await service.from("company_documents").update({ content: content.trim() }).eq("id", existing.id)
    : await service
        .from("company_documents")
        .insert({ company_id: profile.company_id, type: "service_description", title: TITLE, content: content.trim() });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
