import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";

const ACCEPTED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const MAX_BYTES = 5 * 1024 * 1024;

/** Uploads a team member photo to the `logos` storage bucket (shared with company logos) and points team_members.photo_url at it. */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401 });

  const { memberId, mediaType, base64 } = (await req.json()) as {
    memberId?: string;
    mediaType?: string;
    base64?: string;
  };
  if (!memberId || !mediaType || !base64) return NextResponse.json({ error: "Dosya eksik." }, { status: 400 });

  const ext = ACCEPTED_TYPES[mediaType];
  if (!ext) return NextResponse.json({ error: "Sadece PNG, JPG veya WEBP kabul edilir." }, { status: 400 });

  const buffer = Buffer.from(base64, "base64");
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Fotoğraf en fazla 5MB olabilir." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Şirket profilin bulunamadı." }, { status: 404 });

  const { data: member } = await service
    .from("team_members")
    .select("id")
    .eq("id", memberId)
    .eq("company_id", profile.company_id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Ekip üyesi bulunamadı." }, { status: 404 });

  const path = `${profile.company_id}/team/${memberId}.${ext}`;
  const { error: uploadError } = await service.storage
    .from("logos")
    .upload(path, buffer, { contentType: mediaType, upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: publicUrlData } = service.storage.from("logos").getPublicUrl(path);
  const url = `${publicUrlData.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await service.from("team_members").update({ photo_url: url }).eq("id", memberId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ url });
}
