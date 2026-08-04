import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";

export type NotificationItem = {
  id: string;
  type: "viewed" | "signed";
  proposalId: string;
  title: string;
  client: string;
  at: string;
};

/** Live "viewed / signed" feed for the topbar bell — derived straight from proposal_views + signed_at, no extra table to keep in sync. */
export async function GET(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ notifications: [] });

  const { data: proposals } = await service
    .from("proposals")
    .select("id, title, signed_at, clients(name)")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = proposals ?? [];
  const proposalIds = rows.map((p: { id: string }) => p.id);

  const { data: views } = proposalIds.length
    ? await service
        .from("proposal_views")
        .select("id, proposal_id, viewed_at")
        .in("proposal_id", proposalIds)
        .order("viewed_at", { ascending: false })
        .limit(30)
    : { data: [] as { id: string; proposal_id: string; viewed_at: string }[] };

  const byId = new Map<string, (typeof rows)[number]>(rows.map((p: any) => [p.id, p]));

  const notifications: NotificationItem[] = [];

  for (const v of views ?? []) {
    const p = byId.get(v.proposal_id);
    if (!p) continue;
    notifications.push({
      id: `view-${v.id}`,
      type: "viewed",
      proposalId: p.id,
      title: p.title,
      client: p.clients?.name ?? "",
      at: v.viewed_at,
    });
  }

  for (const p of rows) {
    if (!p.signed_at) continue;
    notifications.push({
      id: `sign-${p.id}`,
      type: "signed",
      proposalId: p.id,
      title: p.title,
      client: p.clients?.name ?? "",
      at: p.signed_at,
    });
  }

  notifications.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return NextResponse.json({ notifications: notifications.slice(0, 15) });
}
