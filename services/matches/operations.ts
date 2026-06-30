import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { voidWompiTransaction } from "@/services/payments/service";

export type MatchPlayerRow = {
  id: string;
  /** Null for guest (non-registered) slots. */
  player_id: string | null;
  is_host: boolean;
  status: string;
  joined_at: string | null;
  /** Guest display name (when player_id is null). Never includes the phone. */
  guest_name: string | null;
  /** Profile id of the registered player who invited/paid for a guest. */
  invited_by_player_id: string | null;
  /** Display name of the registered player who invited/paid for a guest. */
  invited_by_name: string | null;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
};

/** Server-side roster: bypasses RLS so names/avatars always load for match detail. */
export async function getPlayersForMatch(matchId: string): Promise<MatchPlayerRow[]> {
  const admin = getSupabaseAdminClient();

  const [{ data: match, error: matchError }, { data: rows, error }] = await Promise.all([
    admin.from("matches").select("host_player_id").eq("id", matchId).maybeSingle(),
    admin
      .from("match_players")
      .select(
        // Pin the profiles embed to the player_id FK: match_players now has a
        // second column referencing profiles (invited_by_player_id), so an
        // unqualified profiles(...) embed is ambiguous (PostgREST 300).
        "id, player_id, is_host, status, joined_at, guest_name, invited_by_player_id, profiles!match_players_player_id_fkey(full_name, avatar_url)",
      )
      .eq("match_id", matchId)
      .order("joined_at", { ascending: true }),
  ]);

  if (matchError) throw matchError;
  if (error) throw error;

  // Resolve inviter display names for guest slots (never expose guest phone).
  const inviterIds = [
    ...new Set(
      (rows ?? [])
        .map((row) => row.invited_by_player_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const inviterNames = new Map<string, string>();
  if (inviterIds.length) {
    const { data: inviters } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", inviterIds);
    for (const inviter of inviters ?? []) {
      inviterNames.set(inviter.id, inviter.full_name ?? "");
    }
  }

  const players: MatchPlayerRow[] = (rows ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      player_id: row.player_id,
      is_host: row.is_host ?? false,
      status: row.status,
      joined_at: row.joined_at,
      guest_name: row.guest_name ?? null,
      invited_by_player_id: row.invited_by_player_id ?? null,
      invited_by_name: row.invited_by_player_id
        ? inviterNames.get(row.invited_by_player_id) ?? null
        : null,
      profiles: profile
        ? { full_name: profile.full_name ?? null, avatar_url: profile.avatar_url ?? null }
        : null,
    };
  });

  // Inject the host into the roster when they have no ACTIVE slot. A host whose
  // pre-checkout expired keeps a cancelled match_players row, which PlayerSlots
  // hides — without this check the host would vanish from their own match.
  const hostId = match?.host_player_id;
  const hostHasActiveSlot = players.some(
    (p) => p.player_id === hostId && (p.status === "paid" || p.status === "pending_payment"),
  );
  if (hostId && !hostHasActiveSlot) {
    const { data: hostProfile } = await admin
      .from("profiles")
      .select("full_name, avatar_url, role")
      .eq("id", hostId)
      .maybeSingle();

    // Organizers create matches but don't occupy a player slot — never inject
    // them into the roster as a confirmed player.
    if (hostProfile?.role !== "organizer") {
      players.unshift({
        id: `host-${hostId}`,
        player_id: hostId,
        is_host: true,
        status: "paid",
        joined_at: null,
        guest_name: null,
        invited_by_player_id: null,
        invited_by_name: null,
        profiles: hostProfile
          ? { full_name: hostProfile.full_name ?? null, avatar_url: hostProfile.avatar_url ?? null }
          : null,
      });
    }
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
  if (error) throw error;

  // After cancelling, automatically void Wompi transactions and record refunds.
  await processAutoRefundsForUnfilledMatches();
}

/**
 * Finds approved payments for cancelled_unfilled matches that have no refund
 * record yet, calls the Wompi void API for each, and records the outcome.
 * Safe to call multiple times — idempotent via the refunds.payment_id unique constraint.
 */
async function processAutoRefundsForUnfilledMatches(): Promise<void> {
  const supabase = getSupabaseAdminClient();

  // 1. Find cancelled_unfilled matches (set by the RPC above).
  const { data: cancelledMatches, error: matchesError } = await supabase
    .from("matches")
    .select("id")
    .eq("status", "cancelled_unfilled")
    .limit(100);

  if (matchesError) {
    console.error("[refunds] Failed to query cancelled matches", matchesError);
    return;
  }
  if (!cancelledMatches?.length) return;

  const matchIds = cancelledMatches.map((m) => m.id);

  // 2. Find approved payments for those matches.
  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select("id, match_id, player_id, amount_cop, wompi_transaction_id")
    .eq("status", "approved")
    .in("match_id", matchIds);

  if (paymentsError) {
    console.error("[refunds] Failed to query payments", paymentsError);
    return;
  }
  if (!payments?.length) return;

  // 3. Exclude payments that already have a refund record.
  const paymentIds = payments.map((p) => p.id);
  const { data: existingRefunds } = await supabase
    .from("refunds")
    .select("payment_id")
    .in("payment_id", paymentIds);

  const alreadyQueued = new Set((existingRefunds ?? []).map((r) => r.payment_id));
  const toProcess = payments.filter((p) => !alreadyQueued.has(p.id));
  if (!toProcess.length) return;

  // 4. For each payment, attempt a Wompi void and record the result.
  for (const payment of toProcess) {
    try {
      if (!payment.wompi_transaction_id) {
        // No Wompi transaction ID — flag for manual review.
        await supabase.from("refunds").upsert(
          {
            payment_id: payment.id,
            amount_cop: payment.amount_cop,
            status: "pending_manual",
            reason: "match_cancelled_unfilled",
          },
          { onConflict: "payment_id" },
        );
        continue;
      }

      const amountInCents = payment.amount_cop * 100;
      const result = await voidWompiTransaction(payment.wompi_transaction_id, amountInCents);

      if (result.success) {
        // Mark payment as voided and refund as done.
        await Promise.all([
          supabase.from("payments").update({ status: "voided" }).eq("id", payment.id),
          supabase.from("refunds").upsert(
            {
              payment_id: payment.id,
              amount_cop: payment.amount_cop,
              status: "refunded",
              reason: "match_cancelled_unfilled",
            },
            { onConflict: "payment_id" },
          ),
        ]);
        console.log(`[refunds] Voided transaction ${payment.wompi_transaction_id} for payment ${payment.id}`);
      } else {
        // Void failed — flag for manual review.
        await supabase.from("refunds").upsert(
          {
            payment_id: payment.id,
            amount_cop: payment.amount_cop,
            status: "pending_manual",
            reason: "match_cancelled_unfilled",
          },
          { onConflict: "payment_id" },
        );
        console.error(`[refunds] Wompi void failed for ${payment.wompi_transaction_id}: ${result.error}`);
      }
    } catch (err) {
      console.error(`[refunds] Unexpected error for payment ${payment.id}:`, err);
    }
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
    .select("id, amount_cop, wompi_transaction_id")
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

    // Attempt automatic Wompi void for each approved payment.
    for (const payment of payments) {
      if (!payment.wompi_transaction_id) continue;
      try {
        const voidResult = await voidWompiTransaction(
          payment.wompi_transaction_id,
          payment.amount_cop * 100,
        );
        if (voidResult.success) {
          await Promise.all([
            supabase.from("payments").update({ status: "voided" }).eq("id", payment.id),
            supabase
              .from("refunds")
              .update({ status: "refunded" })
              .eq("payment_id", payment.id),
          ]);
          console.log("[auto-refund] Voided transaction", payment.wompi_transaction_id, "for payment", payment.id);
        } else {
          console.log("[auto-refund] Void failed for", payment.wompi_transaction_id, "—", voidResult.error, "— left as pending_manual");
        }
      } catch (err) {
        console.log("[auto-refund] Unexpected error voiding payment", payment.id, err);
      }
    }
  }

  await supabase.from("analytics_events").insert({
    event_name: "match_cancelled_by_organizer",
    match_id: matchId,
    properties: { reason },
  });
}

/**
 * Cancels a guest (non-registered) slot. Only the inviter or the match host may
 * do it. The refund goes to whoever PAID (the payment_intent payer), never to
 * the guest (INV-6). Combined Wompi transactions can't be partially voided, so
 * the refund is recorded as pending_manual for the slot's amount.
 */
export async function cancelGuestSpot(
  matchId: string,
  guestMatchPlayerId: string,
  requesterId: string,
) {
  const supabase = getSupabaseAdminClient();

  const { data: slot, error: slotError } = await supabase
    .from("match_players")
    .select("id, match_id, player_id, invited_by_player_id, status")
    .eq("id", guestMatchPlayerId)
    .maybeSingle();
  if (slotError || !slot) throw slotError ?? new Error("Cupo de invitado no encontrado");
  if (slot.match_id !== matchId) throw new Error("El cupo no pertenece a este partido.");
  if (slot.player_id) throw new Error("Este cupo no es de un invitado.");
  if (!["pending_payment", "paid"].includes(slot.status)) {
    throw new Error("Este cupo ya no está activo.");
  }

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("status, scheduled_at, host_player_id")
    .eq("id", matchId)
    .maybeSingle();
  if (matchError || !match) throw matchError ?? new Error("Partido no encontrado");

  const isInviter = slot.invited_by_player_id === requesterId;
  const isHost = match.host_player_id === requesterId;
  if (!isInviter && !isHost) {
    throw new Error("Solo quien invitó o el organizador puede cancelar este cupo.");
  }

  const hoursBeforeStart =
    (new Date(match.scheduled_at).getTime() - Date.now()) / (1000 * 60 * 60);
  const isLate = match.status === "full" || hoursBeforeStart < 3;
  const now = new Date().toISOString();

  const { error: cancelError } = await supabase
    .from("match_players")
    .update({ status: isLate ? "cancelled_late" : "cancelled", cancelled_at: now })
    .eq("id", slot.id);
  if (cancelError) throw cancelError;

  if (!isLate) {
    const { data: payment } = await supabase
      .from("payments")
      .select("id, amount_cop")
      .eq("match_player_id", slot.id)
      .eq("status", "approved")
      .maybeSingle();
    if (payment) {
      const { error: refundError } = await supabase.from("refunds").upsert(
        {
          payment_id: payment.id,
          amount_cop: payment.amount_cop,
          status: "pending_manual",
          reason: "guest_cancelled_by_inviter",
        },
        { onConflict: "payment_id" },
      );
      if (refundError) throw refundError;
    }
  }

  const { data: paidRows } = await supabase
    .from("match_players")
    .select("id")
    .eq("match_id", matchId)
    .eq("status", "paid");
  if (match.status === "full" && (paidRows?.length ?? 0) < 4) {
    await supabase.from("matches").update({ status: "open", filled_at: null }).eq("id", matchId);
  }

  await supabase.from("analytics_events").insert({
    event_name: "guest_cancelled",
    user_id: requesterId,
    match_id: matchId,
    properties: { is_late: isLate, guest_match_player_id: slot.id },
  });

  return { isLate };
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

  if (match.status === "full") {
    throw new Error("No puedes cancelar tu cupo cuando el partido está completo.");
  }

  const hoursBeforeStart =
    (new Date(match.scheduled_at).getTime() - Date.now()) / (1000 * 60 * 60);
  const isLate = hoursBeforeStart < 3;
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
      .select("id, amount_cop, wompi_transaction_id")
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

      // Attempt automatic Wompi void for the player's approved payment.
      if (payment.wompi_transaction_id) {
        try {
          const voidResult = await voidWompiTransaction(
            payment.wompi_transaction_id,
            payment.amount_cop * 100,
          );
          if (voidResult.success) {
            await Promise.all([
              supabase.from("payments").update({ status: "voided" }).eq("id", payment.id),
              supabase
                .from("refunds")
                .update({ status: "refunded" })
                .eq("payment_id", payment.id),
            ]);
            console.log("[auto-refund] Voided transaction", payment.wompi_transaction_id, "for player", playerId);
          } else {
            console.log("[auto-refund] Void failed for", payment.wompi_transaction_id, "—", voidResult.error, "— left as pending_manual");
          }
        } catch (err) {
          console.log("[auto-refund] Unexpected error voiding payment", payment.id, err);
        }
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
