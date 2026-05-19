import crypto from "node:crypto";
import { APP_CONFIG } from "@/config/business";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { sendPaymentStatusEmail, sendMatchFilledEmail } from "@/services/notifications/email";
import {
  notifyOwnerNewGame,
  notifyHostMatchCreated,
  notifyOnPlayerJoined,
  notifyMatchFull,
} from "@/services/notifications/whatsapp";
import { getWompiEnv } from "@/utils/env";

type WompiCheckoutResult = {
  checkoutUrl: string;
  reference: string;
};

export async function createCheckoutForMatch(
  matchId: string,
  options?: { isHost?: boolean },
): Promise<WompiCheckoutResult> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("User is not authenticated");
  }

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("status, org_fee_cop")
    .eq("id", matchId)
    .maybeSingle();
  if (matchError || !match) {
    throw matchError ?? new Error("Match not found");
  }
  if (match.status !== "open") {
    throw new Error("This match is not open for new players.");
  }

  const totalAmountCop = (match.org_fee_cop ?? APP_CONFIG.defaultFeeCop) + APP_CONFIG.platformFeeCop;

  const { count: paidCount, error: paidCountError } = await supabase
    .from("match_players")
    .select("*", { count: "exact", head: true })
    .eq("match_id", matchId)
    .eq("status", "paid");
  if (paidCountError) {
    throw paidCountError;
  }
  if ((paidCount ?? 0) >= APP_CONFIG.maxPlayersPerMatch) {
    throw new Error("This match is already full.");
  }

  const idempotencyKey = crypto.randomUUID();
  const reference = crypto.randomUUID();

  const { data: matchPlayer, error: matchPlayerError } = await supabase
    .from("match_players")
    .insert({
      match_id: matchId,
      player_id: user.id,
      status: "pending_payment",
      is_host: options?.isHost ?? false,
    })
    .select("id")
    .single();

  if (matchPlayerError) {
    throw matchPlayerError;
  }

  const { error: paymentError } = await supabase.from("payments").insert({
    match_player_id: matchPlayer.id,
    match_id: matchId,
    player_id: user.id,
    amount_cop: totalAmountCop,
    status: "pending",
    provider: "wompi",
    wompi_reference: reference,
    idempotency_key: idempotencyKey,
  });

  if (paymentError) {
    throw paymentError;
  }

  await supabase.from("analytics_events").insert({
    event_name: "checkout_started",
    user_id: user.id,
    match_id: matchId,
    properties: { preferred_method: "nequi" },
  });

  const redirectUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/matches/${matchId}`
    : `http://localhost:3000/matches/${matchId}`;

  const wompi = getWompiEnv();
  const response = await fetch("https://production.wompi.co/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${wompi.privateKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount_in_cents: totalAmountCop * 100,
      currency: "COP",
      reference,
      customer_email: user.email ?? "no-email@padelbaq.local",
      redirect_url: redirectUrl,
      payment_method_types: [{ type: "NEQUI" }, { type: "PSE" }, { type: "CARD" }],
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error("Could not create Wompi checkout session");
  }

  const payload = (await response.json()) as {
    data?: { id: string; checkout_url: string };
  };

  if (!payload.data?.checkout_url) {
    throw new Error("Wompi checkout response missing checkout URL");
  }

  return {
    checkoutUrl: payload.data.checkout_url,
    reference,
  };
}

export async function processWompiWebhook(eventPayload: unknown) {
  const payload = eventPayload as {
    event: string;
    data: {
      transaction: {
        id: string;
        reference: string;
        status: "APPROVED" | "DECLINED" | "VOIDED";
        payment_method_type: string;
      };
    };
  };

  if (payload.event !== "transaction.updated") {
    return;
  }

  const tx = payload.data.transaction;
  const supabase = getSupabaseAdminClient();

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("id, match_id, player_id, match_player_id, status, amount_cop")
    .eq("wompi_reference", tx.reference)
    .maybeSingle();

  if (paymentError) {
    throw paymentError;
  }

  if (!payment || payment.status === "approved") {
    return;
  }

  const mappedStatus =
    tx.status === "APPROVED"
      ? "approved"
      : tx.status === "DECLINED"
        ? "declined"
        : "voided";

  const { error: updatePaymentError } = await supabase
    .from("payments")
    .update({
      status: mappedStatus,
      wompi_transaction_id: tx.id,
      payment_method: tx.payment_method_type,
      approved_at: mappedStatus === "approved" ? new Date().toISOString() : null,
    })
    .eq("id", payment.id);

  if (updatePaymentError) {
    throw updatePaymentError;
  }

  const { error: updatePlayerError } = await supabase
    .from("match_players")
    .update({
      status: mappedStatus === "approved" ? "paid" : "cancelled",
      cancelled_at:
        mappedStatus === "approved" ? null : new Date().toISOString(),
    })
    .eq("id", payment.match_player_id);

  if (updatePlayerError) {
    throw updatePlayerError;
  }

  if (mappedStatus === "approved") {
    await supabase.rpc("try_fill_match", { p_match_id: payment.match_id });
    await supabase.from("analytics_events").insert({
      event_name: "payment_approved",
      user_id: payment.player_id,
      match_id: payment.match_id,
      properties: {
        payment_method: tx.payment_method_type,
      },
    });

    const { data: matchStatus } = await supabase
      .from("matches")
      .select("status, host_player_id, venue_name, scheduled_at, max_players")
      .eq("id", payment.match_id)
      .maybeSingle();

    const venueName = matchStatus?.venue_name ?? "Tu partido de pádel";
    const scheduledAt = matchStatus?.scheduled_at ?? null;
    const maxPlayers = matchStatus?.max_players ?? APP_CONFIG.maxPlayersPerMatch;

    // Get the joining player's profile for WhatsApp messages
    const { data: joiningProfile } = await supabase
      .from("profiles")
      .select("full_name, whatsapp_phone")
      .eq("id", payment.player_id)
      .maybeSingle();
    const joiningPlayerName = joiningProfile?.full_name ?? "Un jugador";
    const joiningPlayerPhone = joiningProfile?.whatsapp_phone ?? null;

    // Count paid players AFTER this payment (including current)
    const { count: paidCount } = await supabase
      .from("match_players")
      .select("*", { count: "exact", head: true })
      .eq("match_id", payment.match_id)
      .eq("status", "paid");
    const currentPaidCount = paidCount ?? 1;

    // Check if this is the host joining for the first time (creates + joins)
    const { data: matchPlayer } = await supabase
      .from("match_players")
      .select("is_host")
      .eq("id", payment.match_player_id)
      .maybeSingle();

    const isHost = matchPlayer?.is_host ?? false;

    if (isHost && currentPaidCount === 1) {
      // Host created and joined — notify owner + notify the host themselves
      await notifyOwnerNewGame({
        matchId: payment.match_id,
        hostName: joiningPlayerName,
        venueName,
        scheduledAt,
      });
      if (joiningPlayerPhone) {
        await notifyHostMatchCreated({
          hostPhone: joiningPlayerPhone,
          hostName: joiningPlayerName,
          matchId: payment.match_id,
          venueName,
          scheduledAt,
          maxPlayers,
        });
      }
    } else {
      // A non-host player joined — notify owner + existing players
      await notifyOnPlayerJoined({
        matchId: payment.match_id,
        newPlayerName: joiningPlayerName,
        newPlayerId: payment.player_id,
        venueName,
        scheduledAt,
        currentPaidCount,
        maxPlayers,
      });
    }

    if (matchStatus?.status === "full") {
      await supabase.from("analytics_events").insert({
        event_name: "organizer_notification_needed",
        match_id: payment.match_id,
      });

      // WhatsApp: notify owner + all players that match is full
      await notifyMatchFull({
        matchId: payment.match_id,
        venueName,
        scheduledAt,
        maxPlayers,
      });

      if (matchStatus.host_player_id) {
        const { data: hostAuth } = await supabase.auth.admin.getUserById(
          matchStatus.host_player_id,
        );
        if (hostAuth?.user?.email) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
          await sendMatchFilledEmail({
            to: hostAuth.user.email,
            hostName:
              (hostAuth.user.user_metadata?.full_name as string | undefined) ??
              (hostAuth.user.user_metadata?.first_name as string | undefined) ??
              "Organizador",
            matchVenueName: venueName,
            matchScheduledAt: scheduledAt,
            matchId: payment.match_id,
            appUrl,
          });
        }
      }
    }
  }

  const [{ data: authUser }, { data: matchInfo }] = await Promise.all([
    supabase.auth.admin.getUserById(payment.player_id),
    supabase
      .from("matches")
      .select("venue_name, scheduled_at")
      .eq("id", payment.match_id)
      .maybeSingle(),
  ]);

  if (authUser?.user?.email) {
    await sendPaymentStatusEmail({
      to: authUser.user.email,
      playerName:
        (authUser.user.user_metadata?.full_name as string | undefined) ??
        (authUser.user.user_metadata?.first_name as string | undefined) ??
        "Jugador",
      matchVenueName: matchInfo?.venue_name ?? "Tu partido de pádel",
      matchScheduledAt: matchInfo?.scheduled_at ?? null,
      amountCop: payment.amount_cop,
      status: mappedStatus,
    });
  }
}
