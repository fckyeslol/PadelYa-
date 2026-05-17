import { NextResponse } from "next/server";
import { requireOrganizerUser } from "@/lib/auth/organizer";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    await requireOrganizerUser();
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("matches")
      .select("id, venue_name, scheduled_at, status, org_fee_cop, created_at")
      .order("scheduled_at", { ascending: false })
      .limit(500);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const headers = ["id", "venue_name", "scheduled_at", "status", "org_fee_cop", "created_at"];
    const rows = (data ?? []).map((item) =>
      headers.map((header) => JSON.stringify(item[header as keyof typeof item] ?? "")).join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="padel-baq-matches.csv"',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
