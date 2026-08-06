import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";

const ACCEPTED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};
const MAX_BYTES = 10 * 1024 * 1024;

/** Uploads a company logo to the public `logos` storage bucket and points companies.logo_url at it. */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const { mediaType, base64 } = (await req.json()) as { mediaType?: string; base64?: string };
  if (!mediaType || !base64) return NextResponse.json({ error: "Dosya eksik." }, { status: 400 });

  const ext = ACCEPTED_TYPES[mediaType];
  if (!ext) return NextResponse.json({ error: "Sadece PNG, JPG, WEBP veya SVG kabul edilir." }, { status: 400 });

  const buffer = Buffer.from(base64, "base64");
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Logo en fazla 10MB olabilir." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 });

  const path = `${profile.company_id}/logo.${ext}`;
  const { error: uploadError } = await service.storage
    .from("logos")
    .upload(path, buffer, { contentType: mediaType, upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: publicUrlData } = service.storage.from("logos").getPublicUrl(path);
  const url = `${publicUrlData.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await service.from("companies").update({ logo_url: url }).eq("id", profile.company_id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ url });
}
