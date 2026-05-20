import { NextResponse } from "next/server";
import { requireVenueSession } from "@/lib/auth/venue";
import { listVenueCourts } from "@/services/venue-portal/availability";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireVenueSession();
    const courts = await listVenueCourts(session.venueId);
    const courtIds = courts.map((c) => c.id);

    if (!courtIds.length) {
      return NextResponse.json({
        totalMatches: 0,
        monthMatches: 0,
        weekMatches: 0,
        courts: 0,
        todayMatches: [],
      });
    }

    const admin = getSupabaseAdminClient();
    const ACTIVE = ["pending_court", "open", "full", "confirmed"];

    const todayStr = new Date()
      .toLocaleString("sv-SE", { timeZone: "America/Bogota" })
      .slice(0, 10);
    const todayStart = new Date(`${todayStr}T00:00:00-05:00`).toISOString();
    const todayEnd = new Date(`${todayStr}T23:59:59.999-05:00`).toISOString();

    const nowIso = new Date().toISOString();
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    ).toISOString();

    const weekStartDate = new Date(now);
    weekStartDate.setUTCDate(weekStartDate.getUTCDate() - weekStartDate.getUTCDay());
    weekStartDate.setUTCHours(0, 0, 0, 0);
    const weekStart = weekStartDate.toISOString();

    const [totalRes, monthRes, weekRes, todayRes] = await Promise.all([
      admin
        .from("matches")
        .select("id", { count: "exact", head: true })
        .in("venue_court_id", courtIds)
        .in("status", ACTIVE)
        .gte("scheduled_at", nowIso),
      admin
        .from("matches")
        .select("id", { count: "exact", head: true })
        .in("venue_court_id", courtIds)
        .in("status", ACTIVE)
        .gte("scheduled_at", nowIso)
        .gte("scheduled_at", monthStart),
      admin
        .from("matches")
        .select("id", { count: "exact", head: true })
        .in("venue_court_id", courtIds)
        .in("status", ACTIVE)
        .gte("scheduled_at", nowIso)
        .gte("scheduled_at", weekStart),
      admin
        .from("matches")
        .select("id, scheduled_at, status, skill_level, org_fee_cop, venue_court_id")
        .in("venue_court_id", courtIds)
        .in("status", ACTIVE)
        .gte("scheduled_at", todayStart)
        .lte("scheduled_at", todayEnd)
        .order("scheduled_at", { ascending: true }),
    ]);

    const courtNameMap = Object.fromEntries(courts.map((c) => [c.id, c.name]));

    const todayMatches = (todayRes.data ?? []).map((m) => ({
      id: m.id,
      scheduledAt: m.scheduled_at,
      status: m.status as string,
      skillLevel: m.skill_level as string,
      orgFeeCop: m.org_fee_cop as number,
      courtName: courtNameMap[m.venue_court_id ?? ""] ?? "—",
    }));

    return NextResponse.json({
      totalMatches: totalRes.count ?? 0,
      monthMatches: monthRes.count ?? 0,
      weekMatches: weekRes.count ?? 0,
      courts: courtIds.length,
      todayMatches,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Venue session required") {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    return NextResponse.json({ error: "Error al cargar datos" }, { status: 500 });
  }
}
