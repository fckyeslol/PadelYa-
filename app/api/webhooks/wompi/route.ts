import { NextResponse } from "next/server";
import { processWompiWebhook } from "@/services/payments/service";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    await processWompiWebhook(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook error";
    const status = message.includes("signature") ? 401 : 400;
    console.error("[webhook/wompi]", message, error);
    return NextResponse.json({ error: message }, { status });
  }
}
