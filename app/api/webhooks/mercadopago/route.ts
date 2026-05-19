import { NextResponse } from "next/server";
import { processMercadoPagoWebhook } from "@/services/payments/service";

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const signature = request.headers.get("x-signature");
  const requestId = request.headers.get("x-request-id");

  try {
    await processMercadoPagoWebhook(body, signature, requestId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook error";
    const status = message.includes("signature") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
