import { NextResponse } from "next/server";
import { expirePendingPaymentsNow } from "@/services/matches/operations";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await expirePendingPaymentsNow(15);
    return NextResponse.json({ message: "Expired pending payments were processed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cron failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
