import { NextResponse } from "next/server";
import { syncAvailability } from "@/services/easycancha/sync";

// El sync hace 6 clubes x ~14 días de requests; dale margen.
export const maxDuration = 60;

async function handle(request: Request) {
  const authHeader = request.headers.get("authorization")?.trim();
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await syncAvailability();
    return NextResponse.json({ message: "EasyCancha availability synced", ...summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cron failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// POST para schedulers externos / pg_cron; GET para Vercel Cron (que inyecta el
// header Authorization: Bearer $CRON_SECRET automáticamente).
export const POST = handle;
export const GET = handle;
