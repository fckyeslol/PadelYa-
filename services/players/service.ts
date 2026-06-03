import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  CommunityPlayerCard,
  PlayerMatchHistoryItem,
  PublicPlayerProfile,
} from "@/types/domain";
import { sanitizeDisplayName } from "@/utils/name";

type ProfileRow = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  skill_level: "beginner" | "intermediate" | "advanced";
  whatsapp_phone: string | null;
  created_at: string;
};

type MatchHistoryRow = {
  joined_at: string;
  status: "pending_payment" | "paid" | "cancelled" | "cancelled_late" | "no_show";
  match_id: string;
  matches:
    | {
        id: string;
        venue_name: string;
        scheduled_at: string;
        skill_level: "beginner" | "intermediate" | "advanced";
        status:
          | "pending_court"
          | "open"
          | "full"
          | "confirmed"
          | "completed"
          | "cancelled_unfilled"
          | "cancelled_by_organizer";
        org_fee_cop: number;
      }
    | null;
};

export async function getPublicPlayerProfile(
  playerId: string,
): Promise<PublicPlayerProfile | null> {
  const supabase = getSupabaseAdminClient();

  const [{ data: profile, error: profileError }, { count: matchesPlayed }, { data: upcomingRows }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, avatar_url, skill_level, whatsapp_phone, created_at")
        .eq("id", playerId)
        .maybeSingle(),
      supabase
        .from("match_players")
        .select("id", { head: true, count: "exact" })
        .eq("player_id", playerId)
        .eq("status", "paid"),
      supabase
        .from("match_players")
        .select("matches(scheduled_at, status)")
        .eq("player_id", playerId)
        .in("status", ["paid", "pending_payment"]),
    ]);

  if (profileError) throw profileError;
  if (!profile) return null;

  const now = Date.now();
  const upcomingMatches = (upcomingRows ?? []).filter((row) => {
    const relation = (row as { matches?: unknown }).matches;
    const match = Array.isArray(relation)
      ? ((relation[0] ?? null) as { scheduled_at?: string; status?: string } | null)
      : (relation as { scheduled_at?: string; status?: string } | null);
    if (!match) return false;
    if (!match.scheduled_at || !match.status) return false;
    if (match.status !== "open" && match.status !== "full" && match.status !== "confirmed")
      return false;
    return new Date(match.scheduled_at).getTime() > now;
  }).length;

  const row = profile as ProfileRow;
  return {
    id: row.id,
    fullName: sanitizeDisplayName(row.full_name, "Jugador"),
    avatarUrl: row.avatar_url,
    skillLevel: row.skill_level,
    whatsappPhone: row.whatsapp_phone,
    memberSince: row.created_at,
    matchesPlayed: matchesPlayed ?? 0,
    upcomingMatches,
  };
}

export async function getPlayerMatchHistory(
  playerId: string,
  limit = 20,
): Promise<PlayerMatchHistoryItem[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("match_players")
    .select(
      "match_id, joined_at, status, matches(id, venue_name, scheduled_at, skill_level, status, org_fee_cop)",
    )
    .eq("player_id", playerId)
    .order("joined_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return ((data ?? []) as unknown as MatchHistoryRow[])
    .filter((row) => row.matches)
    .map((row) => ({
      matchId: row.match_id,
      venueName: row.matches!.venue_name,
      scheduledAt: row.matches!.scheduled_at,
      skillLevel: row.matches!.skill_level,
      status: row.matches!.status,
      playerStatus: row.status,
      joinedAt: row.joined_at,
      orgFeeCop: row.matches!.org_fee_cop,
    }));
}

export async function getCommunityStats(): Promise<{ totalPlayers: number; matchesToday: number }> {
  const supabase = getSupabaseAdminClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [{ count: totalPlayers }, { count: matchesToday }] = await Promise.all([
    supabase.from("profiles").select("id", { head: true, count: "exact" }),
    supabase
      .from("matches")
      .select("id", { head: true, count: "exact" })
      .gte("scheduled_at", todayStart.toISOString())
      .lte("scheduled_at", todayEnd.toISOString())
      .not("status", "in", "(cancelled_unfilled,cancelled_by_organizer)"),
  ]);

  return { totalPlayers: totalPlayers ?? 0, matchesToday: matchesToday ?? 0 };
}

export async function listCommunityPlayers(limit = 30, skillLevel?: string): Promise<CommunityPlayerCard[]> {
  const supabase = getSupabaseAdminClient();

  let query = supabase
    .from("profiles")
    .select("id, full_name, avatar_url, skill_level, created_at")
    .order("created_at", { ascending: false })
    .limit(skillLevel ? limit * 4 : limit);

  if (skillLevel) {
    query = query.eq("skill_level", skillLevel);
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as Array<{
    id: string;
    full_name: string;
    avatar_url: string | null;
    skill_level: "beginner" | "intermediate" | "advanced";
    created_at: string;
  }>)
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      fullName: sanitizeDisplayName(row.full_name, "Jugador"),
      avatarUrl: row.avatar_url,
      skillLevel: row.skill_level,
      lastSeenAt: row.created_at,
    }));
}
