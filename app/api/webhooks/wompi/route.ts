import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { processWompiWebhook } from "@/services/payments/service";
import { getWompiEnv } from "@/utils/env";

function isValidSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) {
    return false;
  }

  const { webhookSecret } = getWompiEnv();
  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  return signatureHeader === expected;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature");

  if (!isValidSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    await processWompiWebhook(JSON.parse(rawBody));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
