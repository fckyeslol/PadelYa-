import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { sanitizeDisplayName } from "@/utils/name";

export type MatchRosterPreview = {
  paidCount: number;
  playerNames: string[];
  playerAvatars: (string | null)[];
};

type MatchPlayersRow = {
  player_id: string;
  status: string;
};

type MatchWithPlayers = {
  id: string;
  host_player_id: string;
  match_players: MatchPlayersRow[] | null;
};

const ACTIVE_STATUSES = new Set(["paid", "pending_payment"]);

function mapProfile(
  fullName: string | null | undefined,
  avatarUrl: string | null | undefined,
) {
  return {
    name: sanitizeDisplayName(fullName, "Jugador"),
    avatar: avatarUrl ?? null,
  };
}

/** Server-only: loads names/avatars for match cards (bypasses RLS). Includes host. */
export async function buildMatchRosterPreviews(
  matches: MatchWithPlayers[],
): Promise<Map<string, MatchRosterPreview>> {
  const result = new Map<string, MatchRosterPreview>();
  if (matches.length === 0) return result;

  const profileIds = new Set<string>();
  for (const match of matches) {
    profileIds.add(match.host_player_id);
    for (const player of match.match_players ?? []) {
      if (ACTIVE_STATUSES.has(player.status)) {
        profileIds.add(player.player_id);
      }
    }
  }

  const admin = getSupabaseAdminClient();
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, full_name, avatar_url, role")
    .in("id", [...profileIds]);

  if (error) throw error;

  const profileMap = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      mapProfile(p.full_name, p.avatar_url),
    ]),
  );

  // Organizers create matches but don't occupy a slot — exclude them as host-players.
  const organizerHostIds = new Set(
    (profiles ?? []).filter((p) => p.role === "organizer").map((p) => p.id),
  );

  for (const match of matches) {
    const roster: { status: string; name: string; avatar: string | null }[] = [];
    const seen = new Set<string>();

    const addPlayer = (playerId: string, status: string) => {
      if (seen.has(playerId)) return;
      seen.add(playerId);
      const profile = profileMap.get(playerId) ?? mapProfile(null, null);
      roster.push({ status, ...profile });
    };

    if (!organizerHostIds.has(match.host_player_id)) {
      addPlayer(match.host_player_id, "paid");
    }

    for (const player of match.match_players ?? []) {
      if (!ACTIVE_STATUSES.has(player.status)) continue;
      addPlayer(player.player_id, player.status);
    }

    const visible = roster.slice(0, 4);
    // For list cards, show occupied slots (paid + pending_payment),
    // so the counter matches the visible avatars.
    const paidCount = visible.length;

    result.set(match.id, {
      paidCount,
      playerNames: visible.map((p) => p.name),
      playerAvatars: visible.map((p) => p.avatar),
    });
  }

  return result;
}
