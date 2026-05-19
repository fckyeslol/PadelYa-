import { NextResponse } from "next/server";
import twilio from "twilio";

export const dynamic = "force-dynamic";

export async function GET() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  const ownerPhone = process.env.OWNER_WHATSAPP_PHONE;

  if (!sid || !token || !from || !ownerPhone) {
    return NextResponse.json({ ok: false, error: "Missing env vars" }, { status: 500 });
  }

  try {
    const client = twilio(sid, token);
    const msg = await client.messages.create({
      from: `whatsapp:${from}`,
      to: `whatsapp:${ownerPhone}`,
      body: "🎾 PadelYa! — Mensaje de prueba. ¡Las notificaciones de WhatsApp están funcionando!",
    });

    return NextResponse.json({ ok: true, sid: msg.sid, status: msg.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
