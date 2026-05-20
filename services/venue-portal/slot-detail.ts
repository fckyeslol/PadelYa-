import { bogotaDateAndTime } from "@/config/pricing";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPlayerMatchHistory, getPublicPlayerProfile } from "@/services/players/service";
import type { PlayerMatchHistoryItem, PublicPlayerProfile } from "@/types/domain";

export type VenueSlotPlayerDetail = {
  playerId: string;
  isHost: boolean;
  paymentStatus: string;
  profile: PublicPlayerProfile | null;
  phone: string | null;
  email: string | null;
  history: PlayerMatchHistoryItem[];
};

export type VenueSlotBookingDetail = {
  matchId: string;
  venueName: string;
  scheduledAt: string;
  status: string;
  skillLevel: string;
  orgFeeCop: number;
  courtReference: string | null;
  notes: string | null;
  paidPlayers: VenueSlotPlayerDetail[];
  pendingPlayers: VenueSlotPlayerDetail[];
};

export async function getSlotBookingDetail(
  courtId: string,
  venueId: string,
  date: string,
  time: string,
): Promise<VenueSlotBookingDetail | null> {
  const dayStart = new Date(`${date}T00:00:00-05:00`).toISOString();
  const dayEnd = new Date(`${date}T23:59:59.999-05:00`).toISOString();

  const admin = getSupabaseAdminClient();
  const { data: rows, error } = await admin
    .from("matches")
    .select(
      "id, venue_name, scheduled_at, status, skill_level, org_fee_cop, court_reference, notes, host_player_id, venue_court_id",
    )
    .eq("venue_court_id", courtId)
    .gte("scheduled_at", dayStart)
    .lte("scheduled_at", dayEnd)
    .in("status", ["pending_court", "open", "full", "confirmed"]);

  if (error) throw error;

  const match = (rows ?? []).find((row) => bogotaDateAndTime(row.scheduled_at).time === time);
  if (!match) return null;

  const { data: court } = await admin
    .from("venue_courts")
    .select("venue_id")
    .eq("id", courtId)
    .maybeSingle();

  if (!court || court.venue_id !== venueId) return null;

  const { data: playerRows, error: playersError } = await admin
    .from("match_players")
    .select("player_id, is_host, status")
    .eq("match_id", match.id)
    .in("status", ["paid", "pending_payment"]);

  if (playersError) throw playersError;

  const hostId = match.host_player_id as string;
  const seen = new Set<string>();
  const entries: { playerId: string; isHost: boolean; paymentStatus: string }[] = [];

  for (const row of playerRows ?? []) {
    if (seen.has(row.player_id)) continue;
    seen.add(row.player_id);
    entries.push({
      playerId: row.player_id,
      isHost: row.is_host ?? false,
      paymentStatus: row.status,
    });
  }

  if (!seen.has(hostId)) {
    entries.unshift({
      playerId: hostId,
      isHost: true,
      paymentStatus: "paid",
    });
  }

  const buildPlayer = async (entry: {
    playerId: string;
    isHost: boolean;
    paymentStatus: string;
  }): Promise<VenueSlotPlayerDetail> => {
    const [profile, history, profileRow, authUser] = await Promise.all([
      getPublicPlayerProfile(entry.playerId),
      getPlayerMatchHistory(entry.playerId, 15),
      admin.from("profiles").select("phone").eq("id", entry.playerId).maybeSingle(),
      admin.auth.admin.getUserById(entry.playerId).catch(() => ({ data: { user: null } })),
    ]);

    return {
      playerId: entry.playerId,
      isHost: entry.isHost,
      paymentStatus: entry.paymentStatus,
      profile,
      phone: profileRow.data?.phone ?? null,
      email: authUser.data?.user?.email ?? null,
      history,
    };
  };

  const all = await Promise.all(entries.map(buildPlayer));
  const paidPlayers = all.filter((p) => p.paymentStatus === "paid");
  const pendingPlayers = all.filter((p) => p.paymentStatus === "pending_payment");

  return {
    matchId: match.id,
    venueName: match.venue_name,
    scheduledAt: match.scheduled_at,
    status: match.status,
    skillLevel: match.skill_level,
    orgFeeCop: match.org_fee_cop,
    courtReference: match.court_reference,
    notes: match.notes,
    paidPlayers,
    pendingPlayers,
  };
}
