import { NextResponse } from "next/server";
import { processWompiWebhook } from "@/services/payments/service";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    console.error("[webhook/wompi] Failed to parse JSON body");
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const event = body.event as string | undefined;
  const txRef = (body?.data as Record<string, unknown> | undefined)
    ?.transaction as Record<string, unknown> | undefined;

  console.log("[webhook/wompi] received", {
    event,
    txReference: txRef?.reference,
    txStatus: txRef?.status,
    txId: txRef?.id,
    hasSignature: !!body.signature,
    timestamp: body.timestamp,
  });

  try {
    await processWompiWebhook(body);
    console.log("[webhook/wompi] processed ok", { event, txReference: txRef?.reference });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook error";
    const isSignatureError = message.toLowerCase().includes("signature");
    const status = isSignatureError ? 401 : 400;
    console.error("[webhook/wompi] processing failed", {
      event,
      txReference: txRef?.reference,
      error: message,
      isSignatureError,
    });
    return NextResponse.json({ error: message }, { status });
  }
}
