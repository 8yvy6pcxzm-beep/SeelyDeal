import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";
import { planAllows } from "@/lib/plan";

const ACCEPTED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const MAX_BYTES = 10 * 1024 * 1024;

/** Uploads a custom proposal-cover image to the public `covers` bucket — Custom plan's "premium design services". Same shape as /api/settings/logo. */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const { mediaType, base64 } = (await req.json()) as { mediaType?: string; base64?: string };
  if (!mediaType || !base64) return NextResponse.json({ error: "Dosya eksik." }, { status: 400 });

  const ext = ACCEPTED_TYPES[mediaType];
  if (!ext) return NextResponse.json({ error: "Sadece PNG, JPG veya WEBP kabul edilir." }, { status: 400 });

  const buffer = Buffer.from(base64, "base64");
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Kapak görseli en fazla 10MB olabilir." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 });

  const { data: company } = await service.from("companies").select("plan").eq("id", profile.company_id).maybeSingle();
  if (!planAllows(company?.plan, "premium_design")) {
    return NextResponse.json({ error: "Özel kapak görseli Custom pakette kullanılabilir." }, { status: 403 });
  }

  const path = `${profile.company_id}/cover.${ext}`;
  const { error: uploadError } = await service.storage
    .from("covers")
    .upload(path, buffer, { contentType: mediaType, upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: publicUrlData } = service.storage.from("covers").getPublicUrl(path);
  const url = `${publicUrlData.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await service.from("companies").update({ cover_image_url: url }).eq("id", profile.company_id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ url });
}
