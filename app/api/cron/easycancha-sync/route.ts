import { NextResponse } from "next/server";
import { syncTick } from "@/services/easycancha/sync";

// Heartbeat: procesa solo las cuentas con turno vencido (a lo sumo 6 x ventana caliente).
export const maxDuration = 60;

async function handle(request: Request) {
  const authHeader = request.headers.get("authorization")?.trim();
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await syncTick();
    return NextResponse.json({ message: "EasyCancha sync tick", ...summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cron failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// POST para schedulers externos / pg_cron; GET para Vercel Cron (que inyecta el
// header Authorization: Bearer $CRON_SECRET automáticamente).
export const POST = handle;
export const GET = handle;
