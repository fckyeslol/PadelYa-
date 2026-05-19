import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type MatchPlayerRow = {
  id: string;
  player_id: string;
  is_host: boolean;
  status: string;
  joined_at: string | null;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
};

/** Server-side roster: bypasses RLS so names/avatars always load for match detail. */
export async function getPlayersForMatch(matchId: string): Promise<MatchPlayerRow[]> {
  const admin = getSupabaseAdminClient();

  const [{ data: match, error: matchError }, { data: rows, error }] = await Promise.all([
    admin.from("matches").select("host_player_id").eq("id", matchId).maybeSingle(),
    admin
      .from("match_players")
      .select("id, player_id, is_host, status, joined_at, profiles(full_name, avatar_url)")
      .eq("match_id", matchId)
      .order("joined_at", { ascending: true }),
  ]);

  if (matchError) throw matchError;
  if (error) throw error;

  const players: MatchPlayerRow[] = (rows ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      player_id: row.player_id,
      is_host: row.is_host ?? false,
      status: row.status,
      joined_at: row.joined_at,
      profiles: profile
        ? { full_name: profile.full_name ?? null, avatar_url: profile.avatar_url ?? null }
        : null,
    };
  });

  const hostId = match?.host_player_id;
  if (hostId && !players.some((p) => p.player_id === hostId)) {
    const { data: hostProfile } = await admin
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", hostId)
      .maybeSingle();

    players.unshift({
      id: `host-${hostId}`,
      player_id: hostId,
      is_host: true,
      status: "paid",
      joined_at: null,
      profiles: hostProfile
        ? { full_name: hostProfile.full_name ?? null, avatar_url: hostProfile.avatar_url ?? null }
        : null,
    });
  }

  return players;
}

export async function confirmCourt(matchId: string, courtReference: string) {
  const supabase = getSupabaseAdminClient();
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("status")
    .eq("id", matchId)
    .maybeSingle();

  if (matchError || !match) {
    throw matchError ?? new Error("Partido no encontrado");
  }

  if (match.status === "open" || match.status === "pending_court") {
    throw new Error("Solo puedes confirmar cancha cuando el partido esté lleno.");
  }

  if (match.status !== "full" && match.status !== "confirmed") {
    throw new Error("Este partido no permite confirmación de cancha.");
  }

  const { error } = await supabase
    .from("matches")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      ...(courtReference.trim() ? { court_reference: courtReference.trim() } : {}),
    })
    .eq("id", matchId);

  if (error) {
    throw error;
  }

  await supabase.from("analytics_events").insert({
    event_name: "match_confirmed",
    match_id: matchId,
  });
}

export async function markMatchCompleted(matchId: string) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("matches")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", matchId);

  if (error) {
    throw error;
  }

  await supabase.from("analytics_events").insert({
    event_name: "match_completed",
    match_id: matchId,
  });
}

export async function cancelUnfilledMatchesNow() {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.rpc("cancel_unfilled_matches");
  if (error) {
    throw error;
  }
}

/** Cierra partidos cuya fecha/hora de juego ya pasó (no se muestran en listados abiertos). */
export async function completePastMatchesNow(): Promise<number> {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("matches")
    .update({
      status: "completed",
      completed_at: now,
    })
    .in("status", ["open", "full", "confirmed", "pending_court"])
    .lt("scheduled_at", now)
    .select("id");

  if (error) {
    throw error;
  }

  const ids = (data ?? []).map((row) => row.id);
  if (ids.length > 0) {
    await supabase.from("analytics_events").insert(
      ids.map((matchId) => ({
        event_name: "match_completed",
        match_id: matchId,
        properties: { auto: true, reason: "scheduled_at_passed" },
      })),
    );
  }

  return ids.length;
}

export async function expirePendingPaymentsNow(minutes = 15) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.rpc("expire_pending_match_payments", {
    p_minutes: minutes,
  });
  if (error) {
    throw error;
  }
}

export async function cancelMatchAsOrganizer(matchId: string, reason: string) {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("matches")
    .update({
      status: "cancelled_by_organizer",
      cancelled_at: now,
      cancel_reason: reason || "cancelled_by_organizer",
    })
    .eq("id", matchId);

  if (error) {
    throw error;
  }

  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select("id, amount_cop")
    .eq("match_id", matchId)
    .eq("status", "approved");
  if (paymentsError) {
    throw paymentsError;
  }

  if (payments.length > 0) {
    const { error: refundsError } = await supabase.from("refunds").upsert(
      payments.map((payment) => ({
        payment_id: payment.id,
        amount_cop: payment.amount_cop,
        status: "pending_manual",
        reason: "cancelled_by_organizer",
      })),
      { onConflict: "payment_id" },
    );
    if (refundsError) {
      throw refundsError;
    }
  }

  await supabase.from("analytics_events").insert({
    event_name: "match_cancelled_by_organizer",
    match_id: matchId,
    properties: { reason },
  });
}

export async function cancelPlayerSpot(matchId: string, playerId: string) {
  const supabase = getSupabaseAdminClient();
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("status, scheduled_at")
    .eq("id", matchId)
    .maybeSingle();

  if (matchError || !match) {
    throw matchError ?? new Error("Match not found");
  }

  const hoursBeforeStart =
    (new Date(match.scheduled_at).getTime() - Date.now()) / (1000 * 60 * 60);
  const isLate = match.status === "full" || hoursBeforeStart < 3;
  const now = new Date().toISOString();

  const { data: matchPlayer, error: matchPlayerError } = await supabase
    .from("match_players")
    .select("id")
    .eq("match_id", matchId)
    .eq("player_id", playerId)
    .in("status", ["pending_payment", "paid"])
    .maybeSingle();

  if (matchPlayerError || !matchPlayer) {
    throw matchPlayerError ?? new Error("Player is not part of this match");
  }

  const { error: cancelSpotError } = await supabase
    .from("match_players")
    .update({
      status: isLate ? "cancelled_late" : "cancelled",
      cancelled_at: now,
    })
    .eq("id", matchPlayer.id);
  if (cancelSpotError) {
    throw cancelSpotError;
  }

  if (!isLate) {
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("id, amount_cop")
      .eq("match_player_id", matchPlayer.id)
      .eq("status", "approved")
      .maybeSingle();
    if (paymentError) {
      throw paymentError;
    }

    if (payment) {
      const { error: refundError } = await supabase.from("refunds").upsert(
        {
          payment_id: payment.id,
          amount_cop: payment.amount_cop,
          status: "pending_manual",
          reason: "cancelled_by_player",
        },
        { onConflict: "payment_id" },
      );
      if (refundError) {
        throw refundError;
      }
    }
  }

  const { data: paidRows, error: paidRowsError } = await supabase
    .from("match_players")
    .select("id")
    .eq("match_id", matchId)
    .eq("status", "paid");
  if (paidRowsError) {
    throw paidRowsError;
  }

  if (match.status === "full" && paidRows.length < 4) {
    const { error: reopenError } = await supabase
      .from("matches")
      .update({ status: "open", filled_at: null })
      .eq("id", matchId);
    if (reopenError) {
      throw reopenError;
    }
  }

  await supabase.from("analytics_events").insert({
    event_name: "player_cancelled",
    user_id: playerId,
    match_id: matchId,
    properties: { is_late: isLate, hours_before_start: hoursBeforeStart },
  });

  return { isLate };
}
