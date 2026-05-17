import crypto from "node:crypto";
import { APP_CONFIG } from "@/config/business";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { sendPaymentStatusEmail } from "@/services/notifications/email";
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
      .select("status")
      .eq("id", payment.match_id)
      .maybeSingle();
    if (matchStatus?.status === "full") {
      await supabase.from("analytics_events").insert({
        event_name: "organizer_notification_needed",
        match_id: payment.match_id,
      });
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
