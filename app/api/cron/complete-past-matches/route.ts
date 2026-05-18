import { NextResponse } from "next/server";
import { completePastMatchesNow } from "@/services/matches/operations";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const count = await completePastMatchesNow();
    return NextResponse.json({
      message: "Past matches were marked completed",
      count,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cron failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
