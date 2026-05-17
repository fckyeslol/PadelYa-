import { APP_CONFIG } from "@/config/business";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { upsertProfile } from "@/services/profiles/service";
import type { CreateMatchInput } from "@/types/contracts";
import type { Match, MatchPreview } from "@/types/domain";
import { sanitizeDisplayName } from "@/utils/name";

type MatchRow = {
  id: string;
  host_player_id: string;
  venue_name: string;
  scheduled_at: string;
  join_deadline: string;
  skill_level: Match["skillLevel"];
  max_players: number;
  org_fee_cop: number;
  status: Match["status"];
  notes: string | null;
  cancel_reason: string | null;
  court_reference: string | null;
  created_at: string;
};

type MatchPlayerRow = {
  player_id: string;
  status: string;
  profiles:
    | { full_name: string; avatar_url: string | null }
    | Array<{ full_name: string; avatar_url: string | null }>
    | null;
};

function mapMatch(row: MatchRow): Match {
  return {
    id: row.id,
    hostPlayerId: row.host_player_id,
    venueName: row.venue_name,
    scheduledAt: row.scheduled_at,
    joinDeadline: row.join_deadline,
    skillLevel: row.skill_level,
    maxPlayers: row.max_players,
    orgFeeCop: row.org_fee_cop,
    status: row.status,
    notes: row.notes,
    cancelReason: row.cancel_reason,
    courtReference: row.court_reference,
    createdAt: row.created_at,
  };
}

export async function listOpenMatches(filters?: {
  skillLevel?: Match["skillLevel"];
  date?: string;
}): Promise<MatchPreview[]> {
  const supabase = await getSupabaseServerClient();
  let query = supabase
    .from("matches")
    .select(
      "id, host_player_id, venue_name, scheduled_at, join_deadline, skill_level, max_players, org_fee_cop, status, notes, cancel_reason, court_reference, created_at, match_players(player_id, status, profiles(full_name, avatar_url))",
    )
    .in("status", ["open", "full", "confirmed"])
    .order("scheduled_at", { ascending: true });

  if (filters?.skillLevel) {
    query = query.eq("skill_level", filters.skillLevel);
  }

  if (filters?.date) {
    const start = new Date(`${filters.date}T00:00:00.000-05:00`);
    const end = new Date(`${filters.date}T23:59:59.999-05:00`);
    query = query.gte("scheduled_at", start.toISOString()).lte("scheduled_at", end.toISOString());
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data as unknown as (MatchRow & { match_players: MatchPlayerRow[] })[]).map((row) => {
    const activePlayers = (row.match_players ?? []).filter(
      (p) => p.status === "paid" || p.status === "pending_payment",
    ).slice(0, 4);
    return {
      ...mapMatch(row),
      paidCount: activePlayers.filter((p) => p.status === "paid").length,
      playerNames: activePlayers.map((p) =>
        sanitizeDisplayName(getProfileRow(p.profiles)?.full_name ?? "Jugador", "Jugador"),
      ),
      playerAvatars: activePlayers.map((p) => getProfileRow(p.profiles)?.avatar_url ?? null),
    };
  });
}

function getProfileRow(
  profile: MatchPlayerRow["profiles"],
): { full_name: string; avatar_url: string | null } | null {
  if (!profile) return null;
  return Array.isArray(profile) ? (profile[0] ?? null) : profile;
}

export async function getMatchById(matchId: string): Promise<Match | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("matches")
    .select(
      "id, host_player_id, venue_name, scheduled_at, join_deadline, skill_level, max_players, org_fee_cop, status, notes, cancel_reason, court_reference, created_at",
    )
    .eq("id", matchId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapMatch(data as MatchRow);
}

export async function createMatch(input: CreateMatchInput): Promise<Match> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be logged in to create a match.");
  }

  // Ensure a profile row exists (may be missing if callback failed on first login)
  await upsertProfile(user.id, {
    fullName: user.user_metadata?.full_name ?? user.user_metadata?.first_name ?? user.email ?? "",
  });

  const { data, error } = await supabase
    .from("matches")
    .insert({
      host_player_id: user.id,
      venue_name: input.venueName,
      scheduled_at: input.scheduledAt,
      join_deadline: input.joinDeadline,
      skill_level: input.skillLevel,
      max_players: APP_CONFIG.maxPlayersPerMatch,
      org_fee_cop: APP_CONFIG.defaultFeeCop,
      status: "pending_court",
      notes: input.notes ?? null,
    })
    .select(
      "id, host_player_id, venue_name, scheduled_at, join_deadline, skill_level, max_players, org_fee_cop, status, notes, cancel_reason, court_reference, created_at",
    )
    .single();

  if (error) {
    throw error;
  }

  return mapMatch(data as MatchRow);
}
