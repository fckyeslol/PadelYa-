// TEMPORAL — para confirmar en prod que OWNER_EMAIL está bien y el aviso de reserva
// se manda. Se borra después de probar. Protegido con CRON_SECRET.
import { NextResponse } from "next/server";
import { sendCourtBookingHandoff } from "@/services/easycancha/booking-alert";

export const maxDuration = 30;

async function handle(request: Request) {
  const authHeader = request.headers.get("authorization")?.trim();
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Slot real de Del Río (synced) a 3 días, 08:00 Bogotá.
  const dateStr = new Date(Date.now() + 3 * 86_400_000).toLocaleDateString("en-CA", {
    timeZone: "America/Bogota",
  });
  const scheduledAt = `${dateStr}T08:00:00-05:00`;

  try {
    await sendCourtBookingHandoff({
      matchId: "test-handoff",
      venueName: "Padel Zenter del Rio",
      scheduledAt,
    });
    return NextResponse.json({
      ok: true,
      hasOwnerEmail: Boolean(process.env.OWNER_EMAIL),
      scheduledAt,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "fail", hasOwnerEmail: Boolean(process.env.OWNER_EMAIL) },
      { status: 500 },
    );
  }
}

export const POST = handle;
export const GET = handle;
