import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Contact info for one participant of a match — ORGANIZER-ONLY data.
 * Exposes phone numbers (registered players and guests alike) so the organizer
 * can call/WhatsApp them. Callers MUST gate this behind an organizer check
 * (the match page only fetches it when the viewer's role is 'organizer'); it
 * uses the service-role client and bypasses RLS.
 */
export type MatchContact = {
  matchPlayerId: string;
  name: string;
  /** Digits only, with country code (e.g. "573001112233"); null if unknown. */
  phone: string | null;
  isGuest: boolean;
  /** For guests: who invited/paid for them. */
  invitedByName: string | null;
  status: string;
};

/** Strips everything except digits (drops "+", spaces, dashes). */
function digits(raw: string | null | undefined): string | null {
  const d = (raw ?? "").replace(/\D/g, "");
  return d.length >= 8 ? d : null;
}

type SlotRow = {
  id: string;
  player_id: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  invited_by_player_id: string | null;
  status: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  whatsapp_phone: string | null;
};

/**
 * Active roster (paid + pending) with contact details, for an organizer.
 * No PostgREST embeds: we fetch slots, then the profiles in a second query
 * (avoids the match_players → profiles embed ambiguity, and keeps it testable).
 */
export async function getMatchContactsForOrganizer(matchId: string): Promise<MatchContact[]> {
  const admin = getSupabaseAdminClient();

  const { data: slots, error } = await admin
    .from("match_players")
    .select("id, player_id, guest_name, guest_phone, invited_by_player_id, status")
    .eq("match_id", matchId)
    .in("status", ["paid", "pending_payment"])
    .order("joined_at", { ascending: true });
  if (error) throw error;

  const rows = (slots ?? []) as SlotRow[];

  const profileIds = [
    ...new Set(
      rows
        .flatMap((r) => [r.player_id, r.invited_by_player_id])
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const profiles = new Map<string, ProfileRow>();
  if (profileIds.length) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, full_name, phone, whatsapp_phone")
      .in("id", profileIds);
    for (const p of (profs ?? []) as ProfileRow[]) profiles.set(p.id, p);
  }

  return rows.map((row): MatchContact => {
    if (row.player_id) {
      const p = profiles.get(row.player_id);
      return {
        matchPlayerId: row.id,
        name: p?.full_name?.trim() || "Jugador",
        phone: digits(p?.whatsapp_phone ?? p?.phone),
        isGuest: false,
        invitedByName: null,
        status: row.status,
      };
    }
    const inviter = row.invited_by_player_id ? profiles.get(row.invited_by_player_id) : null;
    return {
      matchPlayerId: row.id,
      name: row.guest_name?.trim() || "Invitado",
      phone: digits(row.guest_phone),
      isGuest: true,
      invitedByName: inviter?.full_name?.trim() || null,
      status: row.status,
    };
  });
}
