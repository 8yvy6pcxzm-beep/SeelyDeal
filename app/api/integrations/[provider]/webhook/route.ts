import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { getCrmProvider } from "@/lib/integrations/crm-providers";

/**
 * Generic inbound webhook receiver for a connected CRM. The connection is
 * identified via ?connectionId=, and the raw body is verified against that
 * connection's stored webhook_secret (HMAC-SHA256, hex, header
 * x-webhook-signature) before the payload is stored for later processing.
 */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!getCrmProvider(provider)) {
    return NextResponse.json({ error: `Bilinmeyen CRM sağlayıcısı: ${provider}` }, { status: 404 });
  }

  const connectionId = new URL(req.url).searchParams.get("connectionId");
  if (!connectionId) return NextResponse.json({ error: "connectionId eksik." }, { status: 400 });

  const rawBody = await req.text();
  const signature = req.headers.get("x-webhook-signature");
  if (!signature) return NextResponse.json({ error: "İmza eksik." }, { status: 401 });

  const service = createServiceClient();
  const { data: connection } = await service
    .from("crm_connections")
    .select("id, webhook_secret")
    .eq("id", connectionId)
    .eq("provider", provider)
    .maybeSingle();

  if (!connection?.webhook_secret) {
    return NextResponse.json({ error: "Bağlantı bulunamadı." }, { status: 404 });
  }

  const expected = createHmac("sha256", connection.webhook_secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const signatureBuf = Buffer.from(signature, "hex");
  const valid =
    expectedBuf.length === signatureBuf.length && timingSafeEqual(expectedBuf, signatureBuf);

  if (!valid) return NextResponse.json({ error: "Geçersiz imza." }, { status: 401 });

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  const { error } = await service.from("crm_webhook_events").insert({ connection_id: connection.id, payload });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
