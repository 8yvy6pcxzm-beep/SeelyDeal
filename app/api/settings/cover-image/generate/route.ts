import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";
import { buildCoverSvg } from "@/lib/generate-cover-svg";

/** Builds a plain gradient cover (see lib/generate-cover-svg.ts) from the company's
 * own primary_color + logo — no image-gen AI involved. This is the onboarding
 * wizard's fallback cover when the customer didn't share an example image worth
 * using directly. Unlike /api/settings/cover-image (manual upload), this isn't gated
 * to the Custom plan — saving is harmless for lower plans since app/p/[id]/page.tsx
 * only renders a cover for Custom anyway.
 *
 * Pass `{ url }` instead to just point cover_image_url at an already-uploaded file
 * (skipping generation entirely) — the onboarding wizard uses this when
 * /api/settings/onboarding/analyze-example already found and uploaded a cover-worthy
 * image from the customer's example, so we don't regenerate over it. */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const { url: overrideUrl } = (await req.json().catch(() => ({}))) as { url?: string };

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 });

  if (overrideUrl) {
    const { error: updateError } = await service.from("companies").update({ cover_image_url: overrideUrl }).eq("id", profile.company_id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json({ url: overrideUrl });
  }

  const { data: company } = await service
    .from("companies")
    .select("primary_color, logo_url")
    .eq("id", profile.company_id)
    .maybeSingle();

  let logoDataUri: string | null = null;
  if (company?.logo_url) {
    try {
      const res = await fetch(company.logo_url);
      if (res.ok) {
        const contentType = res.headers.get("content-type") || "image/png";
        const buffer = Buffer.from(await res.arrayBuffer());
        logoDataUri = `data:${contentType};base64,${buffer.toString("base64")}`;
      }
    } catch {
      logoDataUri = null;
    }
  }

  const svg = buildCoverSvg({ primaryColor: company?.primary_color || "#5B3DF6", logoDataUri });

  const path = `${profile.company_id}/cover.svg`;
  const { error: uploadError } = await service.storage
    .from("covers")
    .upload(path, Buffer.from(svg, "utf-8"), { contentType: "image/svg+xml", upsert: true });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: publicUrlData } = service.storage.from("covers").getPublicUrl(path);
  const url = `${publicUrlData.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await service.from("companies").update({ cover_image_url: url }).eq("id", profile.company_id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ url });
}
