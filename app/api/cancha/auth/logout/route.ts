import { NextResponse } from "next/server";
import { clearVenueSessionCookie } from "@/lib/auth/venue";

export async function POST() {
  await clearVenueSessionCookie();
  return NextResponse.json({ ok: true });
}
