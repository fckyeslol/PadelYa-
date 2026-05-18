import { NextResponse } from "next/server";
import { requireOrganizerUser } from "@/lib/auth/organizer";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request) {
  try {
    await requireOrganizerUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { refundId: string; status: "processed" | "rejected" };
  if (!body.refundId || !["processed", "rejected"].includes(body.status)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from("refunds")
    .update({ status: body.status })
    .eq("id", body.refundId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
