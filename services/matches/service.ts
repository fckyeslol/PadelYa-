import { APP_CONFIG } from "@/config/business";
import { bogotaDateAndTime } from "@/config/pricing";
import { resolvePlayerFeeCop } from "@/services/pricing/resolver";
import { assertVenueHasCourtForSlot } from "@/services/venue-portal/availability";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { buildMatchRosterPreviews } from "@/services/matches/roster-preview";
import { upsertProfile } from "@/services/profiles/service";
import type { CreateMatchInput } from "@/types/contracts";
import type { Match, MatchPreview } from "@/types/domain";

type MatchRow = {
  id: string;
  host_player_id: string;
  venue_name: string;
  scheduled_at: string;
  join_deadline: string;
  skill_level: Match["skillLevel"];
  max_players: number;
  org_fee_cop: number;
  duration_minutes: number;
  status: Match["status"];
  notes: string | null;
  cancel_reason: string | null;
  court_reference: string | null;
  created_at: string;
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
    durationMinutes: (row.duration_minutes === 120 ? 120 : row.duration_minutes === 60 ? 60 : 90) as 60 | 90 | 120,
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
  const admin = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  let query = admin
    .from("matches")
    .select(
      "id, host_player_id, venue_name, scheduled_at, join_deadline, skill_level, max_players, org_fee_cop, duration_minutes, status, notes, cancel_reason, court_reference, created_at, match_players(player_id, status)",
    )
    .in("status", ["open", "full", "confirmed"])
    .gt("scheduled_at", nowIso)
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

  const rows = (data ?? []) as (MatchRow & {
    match_players: { player_id: string; status: string }[] | null;
  })[];

  const rosterByMatch = await buildMatchRosterPreviews(
    rows.map((row) => ({
      id: row.id,
      host_player_id: row.host_player_id,
      match_players: row.match_players,
    })),
  );

  return rows.map((row) => {
    const roster = rosterByMatch.get(row.id) ?? {
      paidCount: 0,
      playerNames: [],
      playerAvatars: [],
    };
    return {
      ...mapMatch(row),
      ...roster,
    };
  });
}

export async function getMatchById(matchId: string): Promise<Match | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("matches")
    .select(
      "id, host_player_id, venue_name, scheduled_at, join_deadline, skill_level, max_players, org_fee_cop, duration_minutes, status, notes, cancel_reason, court_reference, created_at",
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

  const venueCourtId = await assertVenueHasCourtForSlot(input.venueName, input.scheduledAt);

  const durationMinutes = input.durationMinutes ?? 90;
  const { date, time } = bogotaDateAndTime(input.scheduledAt);
  // Tarifa autoritativa: el tarifario que cargó la sede en su portal, con las reglas
  // estáticas como fallback. Se persiste en org_fee_cop (snapshot), así un cambio de
  // tarifa posterior no altera partidos ya creados.
  const orgFeeCop =
    (await resolvePlayerFeeCop(input.venueName, date, time, durationMinutes)) ??
    APP_CONFIG.defaultFeeCop;

  const { data, error } = await supabase
    .from("matches")
    .insert({
      host_player_id: user.id,
      venue_name: input.venueName,
      venue_court_id: venueCourtId,
      scheduled_at: input.scheduledAt,
      join_deadline: input.joinDeadline,
      skill_level: input.skillLevel,
      max_players: APP_CONFIG.maxPlayersPerMatch,
      org_fee_cop: orgFeeCop,
      duration_minutes: durationMinutes,
      status: "pending_court",
      notes: input.notes ?? null,
    })
    .select(
      "id, host_player_id, venue_name, scheduled_at, join_deadline, skill_level, max_players, org_fee_cop, duration_minutes, status, notes, cancel_reason, court_reference, created_at",
    )
    .single();

  if (error) {
    throw error;
  }

  return mapMatch(data as MatchRow);
}
