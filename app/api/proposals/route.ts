import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";

export async function POST(req: Request) {
  const body = await req.json();
  const { title, client, value, sections, lineItems, contractText, paymentLink, billingOptions, introText, aboutText, clientContact, nextSteps, validDays, themeJson, templateId, format } = body;

  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profili bulunamadı." }, { status: 404 });

  let clientId: string | null = null;
  if (client) {
    const { data: existing } = await service
      .from("clients")
      .select("id")
      .eq("company_id", profile.company_id)
      .eq("name", client)
      .maybeSingle();

    if (existing) {
      clientId = existing.id;
    } else {
      const { data: created } = await service
        .from("clients")
        .insert({ company_id: profile.company_id, name: client })
        .select("id")
        .single();
      clientId = created?.id ?? null;
    }
  }

  const numericValue = Number(value);

  const { data: proposal, error } = await service
    .from("proposals")
    .insert({
      company_id: profile.company_id,
      client_id: clientId,
      title: title || "Yeni teklif",
      value: Number.isFinite(numericValue) ? numericValue : 0,
      sections: Array.isArray(sections) ? sections : [],
      line_items: Array.isArray(lineItems) ? lineItems : [],
      contract_text: contractText || null,
      payment_link: paymentLink || null,
      billing_options: Array.isArray(billingOptions) ? billingOptions : [],
      intro_text: introText || null,
      about_text: aboutText || null,
      client_contact: clientContact && typeof clientContact === "object" ? clientContact : {},
      next_steps: Array.isArray(nextSteps) ? nextSteps : [],
      valid_days: Number.isFinite(Number(validDays)) ? Number(validDays) : 15,
      theme_json: themeJson && typeof themeJson === "object" ? themeJson : null,
      created_by: user.id,
      template_id: templateId || null,
      format: format === "pdf" || format === "html" ? format : null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("POST /api/proposals insert failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: proposal.id });
}

export async function GET(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ proposals: [] });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ proposals: [] });

  const { data: proposals } = await service
    .from("proposals")
    .select("*, clients(name)")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: false });

  const ids = (proposals ?? []).map((p: { id: string }) => p.id);
  const { data: views } = ids.length
    ? await service.from("proposal_views").select("proposal_id, viewed_at").in("proposal_id", ids)
    : { data: [] as { proposal_id: string; viewed_at: string }[] };

  const dayKeys = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });

  // "Live now": a proposal counts as currently being viewed if its most recent open was within the last 3 minutes.
  const LIVE_WINDOW_MS = 3 * 60 * 1000;
  const now = Date.now();

  const withViews = (proposals ?? []).map((p: { id: string; live_selection_at?: string | null; live_selection?: unknown }) => {
    const rows = (views ?? []).filter((v: { proposal_id: string }) => v.proposal_id === p.id);
    const spark = dayKeys.map((day) => rows.filter((v: { viewed_at: string }) => v.viewed_at.slice(0, 10) === day).length);
    const lastViewedAt: string | null = rows.reduce(
      (latest: string | null, v: { viewed_at: string }) => (!latest || v.viewed_at > latest ? v.viewed_at : latest),
      null,
    );
    const liveNow = !!lastViewedAt && now - new Date(lastViewedAt).getTime() < LIVE_WINDOW_MS;
    const liveSelectionFresh = !!p.live_selection_at && now - new Date(p.live_selection_at).getTime() < LIVE_WINDOW_MS;
    return {
      ...p,
      view_count: rows.length,
      view_spark: spark,
      view_times: rows.map((v: { viewed_at: string }) => v.viewed_at).sort(),
      last_viewed_at: lastViewedAt,
      live_now: liveNow,
      live_selection: liveSelectionFresh ? p.live_selection : null,
    };
  });

  return NextResponse.json({ proposals: withViews });
}
