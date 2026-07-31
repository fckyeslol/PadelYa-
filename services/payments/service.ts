import crypto from "node:crypto";
import { APP_CONFIG } from "@/config/business";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { sendPaymentStatusEmail, sendMatchFilledEmail } from "@/services/notifications/email";
import {
  notifyOnPlayerJoined,
  notifyMatchFull,
  notifyGuestAdded,
} from "@/services/notifications/whatsapp";
import { sendCourtBookingHandoff } from "@/services/matches/court-booking-handoff";
import {
  assertCapacity,
  assertGuestsNotRegisteredPlayers,
  assertInviteAuthorized,
  prepareGuests,
  type NormalizedGuest,
} from "@/services/payments/combined-checkout.helpers";
import { getAppUrl } from "@/utils/auth-url";
import { getWompiPublicKey, getWompiIntegritySecret, getWompiEventsSecret, getWompiPrivateKey } from "@/utils/env";
import { getErrorMessage } from "@/utils/errors";
import { samePhone } from "@/utils/phone";

type AdminClient = ReturnType<typeof getSupabaseAdminClient>;

// ── Types ──────────────────────────────────────────────────────────────────

export type CheckoutResult = {
  /** UUID sent to Wompi as the payment reference — stored in payments.wompi_reference */
  reference: string;
  /** Amount in Colombian centavos (COP * 100) */
  amountInCents: number;
  /** SHA-256(reference + amountInCents + "COP" + integritySecret) */
  integritySignature: string;
  /** pub_test_… / pub_prod_… — safe to expose in the browser */
  publicKey: string;
  /** Where Wompi redirects after the payment overlay closes */
  redirectUrl: string;
};

// ── Wompi: void transaction via management API ────────────────────────────

/** Calls the Wompi void endpoint to cancel an approved transaction. */
export async function voidWompiTransaction(
  transactionId: string,
  amountInCents: number,
): Promise<{ success: boolean; error?: string }> {
  const privateKey = getWompiPrivateKey();
  const isSandbox = privateKey.startsWith("prv_test_");
  const baseUrl = isSandbox
    ? "https://sandbox.wompi.co/v1"
    : "https://production.wompi.co/v1";

  try {
    const res = await fetch(`${baseUrl}/transactions/${transactionId}/void`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${privateKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount_in_cents: amountInCents }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { success: false, error: `HTTP ${res.status}: ${body}` };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

// ── Wompi: integrity signature ─────────────────────────────────────────────

/** Generates the Wompi integrity hash required by the Widget and Hosted Page. */
function generateWompiIntegrity(
  reference: string,
  amountInCents: number,
  integritySecret: string,
): string {
  return crypto
    .createHash("sha256")
    .update(`${reference}${amountInCents}COP${integritySecret}`)
    .digest("hex");
}

// ── Wompi: webhook event types ─────────────────────────────────────────────

interface WompiTransaction {
  id: string;
  reference: string;
  amount_in_cents: number;
  currency: string;
  status: "APPROVED" | "DECLINED" | "VOIDED" | "PENDING" | "ERROR";
  payment_method_type: string;
  created_at: string;
}

interface WompiWebhookEvent {
  event: string;
  data: { transaction: WompiTransaction };
  timestamp: number;
  signature: { properties: string[]; checksum: string };
}

/** Verifies the Wompi webhook event signature using the events secret key. */
function verifyWompiSignature(event: WompiWebhookEvent, eventsSecret: string): boolean {
  const { properties, checksum } = event.signature;
  const tx = event.data.transaction as unknown as Record<string, unknown>;
  const values = properties.map((prop) => {
    const key = prop.replace("transaction.", "");
    return String(tx[key] ?? "");
  });
  const manifest = [...values, String(event.timestamp), eventsSecret].join("");
  const expected = crypto.createHash("sha256").update(manifest).digest("hex");
  const ok = expected === checksum;
  if (!ok) {
    console.error("[webhook/wompi] signature mismatch", {
      properties,
      expectedLength: expected.length,
      checksumLength: checksum.length,
      secretPrefix: eventsSecret.slice(0, 12) + "...",
    });
  }
  return ok;
}

// ── DB: reserve match_players slot ────────────────────────────────────────

function isPostgresUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23505"
  );
}

/** Reserves a match_players row; reuses existing row (unique on match_id + player_id). */
async function reserveMatchPlayerForCheckout(
  supabase: AdminClient,
  matchId: string,
  playerId: string,
  isHost: boolean,
): Promise<string> {
  const { data: existing } = await supabase
    .from("match_players")
    .select("id, status")
    .eq("match_id", matchId)
    .eq("player_id", playerId)
    .maybeSingle();

  if (existing?.status === "paid") {
    throw new Error("Ya tienes un cupo confirmado en este partido.");
  }

  if (existing?.status === "pending_payment") {
    return existing.id;
  }

  if (existing) {
    const { data: updated, error } = await supabase
      .from("match_players")
      .update({ status: "pending_payment", is_host: isHost, cancelled_at: null })
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) throw new Error(getErrorMessage(error, "No se pudo reservar tu cupo"));
    return updated.id;
  }

  const { data: created, error } = await supabase
    .from("match_players")
    .insert({ match_id: matchId, player_id: playerId, status: "pending_payment", is_host: isHost })
    .select("id")
    .single();

  if (!error) return created.id;

  if (isPostgresUniqueViolation(error)) {
    const { data: raced } = await supabase
      .from("match_players")
      .select("id, status")
      .eq("match_id", matchId)
      .eq("player_id", playerId)
      .maybeSingle();

    if (raced?.status === "paid") throw new Error("Ya tienes un cupo confirmado en este partido.");

    if (raced) {
      if (raced.status !== "pending_payment") {
        const { error: updateError } = await supabase
          .from("match_players")
          .update({ status: "pending_payment", is_host: isHost, cancelled_at: null })
          .eq("id", raced.id);
        if (updateError) throw new Error(getErrorMessage(updateError, "No se pudo reservar tu cupo"));
      }
      return raced.id;
    }
  }

  throw new Error(getErrorMessage(error, "No se pudo reservar tu cupo"));
}

// ── DB: reserve a guest match_players slot ────────────────────────────────

/** Reserves (or reuses) a guest slot for a match; returns its match_player id. */
async function reserveGuestSlot(
  supabase: AdminClient,
  matchId: string,
  guest: NormalizedGuest,
  inviterId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("match_players")
    .select("id, status")
    .eq("match_id", matchId)
    .eq("guest_phone", guest.phone)
    .in("status", ["pending_payment", "paid"])
    .maybeSingle();

  if (existing?.status === "paid") {
    throw new Error(`"${guest.name}" ya tiene un cupo confirmado en este partido.`);
  }
  if (existing?.status === "pending_payment") {
    await supabase
      .from("match_players")
      .update({ guest_name: guest.name, invited_by_player_id: inviterId })
      .eq("id", existing.id);
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from("match_players")
    .insert({
      match_id: matchId,
      player_id: null,
      guest_name: guest.name,
      guest_phone: guest.phone,
      invited_by_player_id: inviterId,
      status: "pending_payment",
    })
    .select("id")
    .single();

  if (!error) return created.id;

  if (isPostgresUniqueViolation(error)) {
    const { data: raced } = await supabase
      .from("match_players")
      .select("id, status")
      .eq("match_id", matchId)
      .eq("guest_phone", guest.phone)
      .in("status", ["pending_payment", "paid"])
      .maybeSingle();
    if (raced?.status === "paid") {
      throw new Error(`"${guest.name}" ya tiene un cupo confirmado en este partido.`);
    }
    if (raced) return raced.id;
  }

  throw new Error(getErrorMessage(error, "No se pudo reservar el cupo del invitado"));
}

// ── Checkout: create DB records + return Wompi params ─────────────────────

/**
 * Combined checkout: optionally the payer's own slot + N guest slots, settled in
 * a single Wompi transaction via a payment_intent (children = one payment per
 * slot). Backward-compatible with the individual flow (includeSelf, no guests).
 *
 * Authentication uses the user session; all writes use the admin client after
 * authorization is enforced in code (see combined-checkout.helpers).
 */
export async function createCombinedCheckout(input: {
  matchId: string;
  includeSelf: boolean;
  guests: { name: string; phone: string }[];
}): Promise<CheckoutResult> {
  const session = await getSupabaseServerClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) throw new Error("User is not authenticated");

  const supabase = getSupabaseAdminClient();
  const { matchId } = input;

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("status, org_fee_cop, venue_name, scheduled_at, host_player_id, max_players")
    .eq("id", matchId)
    .maybeSingle();
  if (matchError) throw new Error(getErrorMessage(matchError, "No se pudo cargar el partido"));
  if (!match) throw new Error("Partido no encontrado");
  if (match.status !== "open") throw new Error("Este partido ya no acepta jugadores.");
  if (!match.org_fee_cop) {
    throw new Error("Este partido no tiene una tarifa válida. Contacta al organizador.");
  }

  const orgFeeCop = match.org_fee_cop;
  const maxPlayers = match.max_players ?? APP_CONFIG.maxPlayersPerMatch;
  const isHost = user.id === match.host_player_id;

  const guests = prepareGuests(input.guests);

  // Payer's own slot (if any) — needed for authorization + capacity math.
  const { data: ownSlot } = await supabase
    .from("match_players")
    .select("id, status")
    .eq("match_id", matchId)
    .eq("player_id", user.id)
    .maybeSingle();
  const isAlreadyPaid = ownSlot?.status === "paid";

  assertInviteAuthorized({
    includeSelf: input.includeSelf,
    isAlreadyPaid,
    isHost,
    hasGuests: guests.length > 0,
  });

  if (input.includeSelf && isAlreadyPaid) {
    throw new Error("Ya tienes un cupo confirmado en este partido.");
  }

  // Current active (paid + pending) slots — for capacity + duplicate checks.
  const { data: activeRows, error: activeError } = await supabase
    .from("match_players")
    .select("player_id, guest_phone, status")
    .eq("match_id", matchId)
    .in("status", ["paid", "pending_payment"]);
  if (activeError) throw new Error(getErrorMessage(activeError, "No se pudo verificar cupos"));
  const active = activeRows ?? [];

  // INV-4: a guest phone must not collide with a registered player in the match.
  const registeredIds = active.map((r) => r.player_id).filter(Boolean) as string[];
  if (registeredIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("phone, whatsapp_phone")
      .in("id", registeredIds);
    const phones = (profs ?? []).flatMap((p) => [p.phone, p.whatsapp_phone]);
    assertGuestsNotRegisteredPlayers(guests, phones);
  }

  // INV-2: only brand-new slots count against capacity (reused ones already do).
  const ownActive = active.some((r) => r.player_id === user.id);
  const ownIsBrandNew = input.includeSelf && !ownActive;
  const guestNewCount = guests.filter(
    (g) => !active.some((r) => r.guest_phone && samePhone(r.guest_phone, g.phone)),
  ).length;
  assertCapacity({
    maxPlayers,
    activeCount: active.length,
    brandNewCount: (ownIsBrandNew ? 1 : 0) + guestNewCount,
  });

  // Reserve the slots (own + guests).
  const slots: { matchPlayerId: string; playerId: string | null }[] = [];
  if (input.includeSelf) {
    const ownId = await reserveMatchPlayerForCheckout(supabase, matchId, user.id, isHost);
    slots.push({ matchPlayerId: ownId, playerId: user.id });
  }
  for (const guest of guests) {
    const guestId = await reserveGuestSlot(supabase, matchId, guest, user.id);
    slots.push({ matchPlayerId: guestId, playerId: null });
  }
  if (slots.length === 0) throw new Error("Debes pagar al menos un cupo.");

  const totalAmountCop = orgFeeCop * slots.length;
  const amountInCents = totalAmountCop * 100;

  // Reuse a pending intent for (match, payer); otherwise create a fresh one.
  const { data: existingIntent } = await supabase
    .from("payment_intents")
    .select("id, wompi_reference")
    .eq("match_id", matchId)
    .eq("paid_by_player_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let intentId: string;
  let reference: string;

  if (existingIntent?.wompi_reference) {
    intentId = existingIntent.id;
    reference = existingIntent.wompi_reference;
    await supabase
      .from("payment_intents")
      .update({ amount_cop: totalAmountCop })
      .eq("id", intentId);
    // Rebuild child allocations to match the current slot set.
    await supabase
      .from("payments")
      .delete()
      .eq("payment_intent_id", intentId)
      .eq("status", "pending");
  } else {
    reference = crypto.randomUUID();
    const { data: createdIntent, error: intentError } = await supabase
      .from("payment_intents")
      .insert({
        match_id: matchId,
        paid_by_player_id: user.id,
        amount_cop: totalAmountCop,
        provider: "wompi",
        wompi_reference: reference,
        status: "pending",
        idempotency_key: crypto.randomUUID(),
      })
      .select("id")
      .single();
    if (intentError) {
      throw new Error(getErrorMessage(intentError, "No se pudo registrar el pago"));
    }
    intentId = createdIntent.id;
  }

  const childRows = slots.map((slot) => ({
    payment_intent_id: intentId,
    match_player_id: slot.matchPlayerId,
    match_id: matchId,
    player_id: slot.playerId,
    amount_cop: orgFeeCop,
    status: "pending" as const,
    provider: "wompi",
    idempotency_key: crypto.randomUUID(),
  }));
  const { error: paymentError } = await supabase.from("payments").insert(childRows);
  if (paymentError) throw new Error(getErrorMessage(paymentError, "No se pudo registrar el pago"));

  await supabase.from("analytics_events").insert({
    event_name: "checkout_started",
    user_id: user.id,
    match_id: matchId,
    properties: { provider: "wompi", slots: slots.length, guests: guests.length },
  });

  return {
    reference,
    amountInCents,
    integritySignature: generateWompiIntegrity(
      reference,
      amountInCents,
      getWompiIntegritySecret(),
    ),
    publicKey: getWompiPublicKey(),
    redirectUrl: `${getAppUrl()}/matches/${matchId}`,
  };
}

/**
 * Individual checkout (the payer's own slot only). Thin wrapper over the
 * combined flow — kept for the existing checkout route and host pre-checkout.
 */
export async function createCheckoutForMatch(matchId: string): Promise<CheckoutResult> {
  return createCombinedCheckout({ matchId, includeSelf: true, guests: [] });
}

// ── Webhook: async confirmation from Wompi ─────────────────────────────────

export async function processWompiWebhook(body: Record<string, unknown>): Promise<void> {
  const event = body as unknown as WompiWebhookEvent;

  if (event.event !== "transaction.updated") {
    console.log("[webhook/wompi] skipping non-transaction event:", event.event);
    return;
  }
  if (!event.data?.transaction?.reference) {
    console.error("[webhook/wompi] missing transaction reference in payload");
    return;
  }

  // Verify signature.
  const eventsSecret = getWompiEventsSecret();
  if (!verifyWompiSignature(event, eventsSecret)) {
    throw new Error("Invalid Wompi webhook signature");
  }

  const tx = event.data.transaction;
  console.log("[webhook/wompi] signature ok, processing tx", {
    reference: tx.reference,
    status: tx.status,
    id: tx.id,
  });

  const supabase = getSupabaseAdminClient();

  // New flow: the reference belongs to a payment_intent (one or more slots).
  const { data: intent } = await supabase
    .from("payment_intents")
    .select("id, match_id, paid_by_player_id, status, amount_cop")
    .eq("wompi_reference", tx.reference)
    .maybeSingle();
  if (intent) {
    await _processIntentWebhook(intent, tx);
    return;
  }

  // Legacy fallback: the reference belongs to an individual payments row.
  const { data: payment, error: paymentLookupError } = await supabase
    .from("payments")
    .select("id, match_id, player_id, match_player_id, status, amount_cop")
    .eq("wompi_reference", tx.reference)
    .maybeSingle();

  if (paymentLookupError) {
    console.error("[webhook/wompi] DB error looking up payment:", paymentLookupError.message);
    throw new Error("DB lookup failed: " + paymentLookupError.message);
  }

  if (!payment) {
    console.error("[webhook/wompi] no payment found for reference:", tx.reference);
    return;
  }

  if (payment.status === "approved") {
    console.log("[webhook/wompi] payment already approved, skipping:", payment.id);
    return;
  }

  console.log("[webhook/wompi] found payment", { id: payment.id, currentStatus: payment.status });

  const mappedStatus =
    tx.status === "APPROVED"
      ? "approved"
      : tx.status === "PENDING"
        ? "pending"
        : "declined";

  // Atomic update: guard against concurrent webhooks double-processing.
  const { data: claimed } = await supabase
    .from("payments")
    .update({
      wompi_transaction_id: tx.id,
      status: mappedStatus,
      payment_method: tx.payment_method_type,
      approved_at: mappedStatus === "approved" ? new Date().toISOString() : null,
    })
    .eq("id", payment.id)
    .neq("status", "approved")
    .select("id");

  if (!claimed?.length) return;

  if (mappedStatus === "approved") {
    await _handleApprovedPayment({
      paymentId: payment.id,
      matchId: payment.match_id,
      playerId: payment.player_id,
      matchPlayerId: payment.match_player_id,
      paymentMethod: tx.payment_method_type,
      amountCop: payment.amount_cop,
    });
  } else {
    const { data: mp } = await supabase
      .from("match_players")
      .select("status")
      .eq("id", payment.match_player_id)
      .maybeSingle();
    if (mp?.status !== "paid") {
      await supabase
        .from("match_players")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
        .eq("id", payment.match_player_id);
      await _sendPaymentEmail(
        payment.player_id,
        payment.match_id,
        payment.amount_cop,
        "declined",
      );
    }
  }
}

// ── Webhook: payment_intent path (combined checkout) ──────────────────────

type IntentRow = {
  id: string;
  match_id: string;
  paid_by_player_id: string;
  status: string;
  amount_cop: number;
};

async function _processIntentWebhook(intent: IntentRow, tx: WompiTransaction): Promise<void> {
  const supabase = getSupabaseAdminClient();

  if (intent.status === "approved") {
    console.log("[webhook/wompi] intent already approved, skipping:", intent.id);
    return;
  }

  const mappedStatus =
    tx.status === "APPROVED" ? "approved" : tx.status === "PENDING" ? "pending" : "declined";

  // Atomic claim: guard against concurrent webhooks double-processing.
  const { data: claimed } = await supabase
    .from("payment_intents")
    .update({
      wompi_transaction_id: tx.id,
      status: mappedStatus,
      payment_method: tx.payment_method_type,
      approved_at: mappedStatus === "approved" ? new Date().toISOString() : null,
    })
    .eq("id", intent.id)
    .neq("status", "approved")
    .select("id");
  if (!claimed?.length) return;

  // Propagate status to all child allocations.
  await supabase
    .from("payments")
    .update({
      status: mappedStatus,
      wompi_transaction_id: tx.id,
      payment_method: tx.payment_method_type,
      approved_at: mappedStatus === "approved" ? new Date().toISOString() : null,
    })
    .eq("payment_intent_id", intent.id)
    .neq("status", "approved");

  if (mappedStatus === "approved") {
    await _handleApprovedIntent(intent, tx.payment_method_type);
  } else if (mappedStatus === "declined") {
    // Free any still-pending slots funded by this intent.
    const { data: children } = await supabase
      .from("payments")
      .select("match_player_id")
      .eq("payment_intent_id", intent.id);
    const slotIds = (children ?? []).map((c) => c.match_player_id);
    if (slotIds.length) {
      await supabase
        .from("match_players")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
        .in("id", slotIds)
        .neq("status", "paid");
    }
    await _sendPaymentEmail(intent.paid_by_player_id, intent.match_id, intent.amount_cop, "declined");
  }
}

async function _handleApprovedIntent(intent: IntentRow, paymentMethod: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { id: intentId, match_id: matchId, paid_by_player_id: payerId } = intent;

  // Slots funded by this intent.
  const { data: children } = await supabase
    .from("payments")
    .select("match_player_id")
    .eq("payment_intent_id", intentId);
  const slotIds = (children ?? []).map((c) => c.match_player_id);
  if (!slotIds.length) return;

  const { data: slots } = await supabase
    .from("match_players")
    .select("id, player_id, is_host, guest_name, guest_phone, status")
    .in("id", slotIds);

  // Mark all funded slots paid.
  await supabase.from("match_players").update({ status: "paid" }).in("id", slotIds);

  const { data: fillResult } = await supabase.rpc("try_fill_match", { p_match_id: matchId });
  const justFilled = fillResult === "full";

  await supabase.from("analytics_events").insert({
    event_name: "payment_approved",
    user_id: payerId,
    match_id: matchId,
    properties: { payment_method: paymentMethod, provider: "wompi", slots: slotIds.length },
  });

  const { data: matchInfo } = await supabase
    .from("matches")
    .select("status, host_player_id, venue_name, scheduled_at, max_players")
    .eq("id", matchId)
    .maybeSingle();
  const venueName = matchInfo?.venue_name ?? "Tu partido de pádel";
  const scheduledAt = matchInfo?.scheduled_at ?? null;
  const maxPlayers = matchInfo?.max_players ?? APP_CONFIG.maxPlayersPerMatch;

  const { data: payerProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", payerId)
    .maybeSingle();
  const inviterName = payerProfile?.full_name ?? "Un jugador";

  const { count: paidCount } = await supabase
    .from("match_players")
    .select("*", { count: "exact", head: true })
    .eq("match_id", matchId)
    .eq("status", "paid");
  const currentPaidCount = paidCount ?? slotIds.length;

  // Notify host + existing players for each newly added participant, and the
  // guest directly. Isolated so a notification failure never breaks payment.
  for (const slot of slots ?? []) {
    try {
      if (slot.player_id) {
        // Registered slot (typically the payer's own). Suppress the host's very
        // first slot — they already got "partido_creado" on publish.
        const playerName = slot.player_id === payerId ? inviterName : "Un jugador";
        if (!(slot.is_host && currentPaidCount === 1)) {
          await notifyOnPlayerJoined({
            matchId,
            newPlayerName: playerName,
            newPlayerId: slot.player_id,
            venueName,
            scheduledAt,
            currentPaidCount,
            maxPlayers,
          });
        }
      } else if (slot.guest_name && slot.guest_phone) {
        // Tell the guest they're in, and let existing players see the roster grow.
        await notifyGuestAdded({
          guestPhone: slot.guest_phone,
          guestName: slot.guest_name,
          inviterName,
          matchId,
          venueName,
          scheduledAt,
        });
        await notifyOnPlayerJoined({
          matchId,
          newPlayerName: slot.guest_name,
          newPlayerId: payerId, // exclude the payer from "joined" fan-out
          venueName,
          scheduledAt,
          currentPaidCount,
          maxPlayers,
        });
      }
    } catch (err) {
      console.error("[WhatsApp] notification failed after combined payment", err);
    }
  }

  if (justFilled) {
    try {
      await supabase.from("analytics_events").insert({
        event_name: "organizer_notification_needed",
        match_id: matchId,
      });
      await notifyMatchFull({ matchId, venueName, scheduledAt, maxPlayers });

      if (matchInfo?.host_player_id) {
        const { data: hostAuth } = await supabase.auth.admin.getUserById(matchInfo.host_player_id);
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
            matchId,
            appUrl,
          });
        }
      }
    } catch (err) {
      console.error("[notifications] match-filled notifications failed", err);
    }

    try {
      await sendCourtBookingHandoff({ matchId, venueName, scheduledAt });
    } catch (err) {
      console.error("[court-booking] handoff failed", err);
    }
  }

  // One payment receipt email to the payer for the full amount.
  await _sendPaymentEmail(payerId, matchId, intent.amount_cop, "approved");
}

// ── Shared: handle an approved payment ────────────────────────────────────

async function _handleApprovedPayment({
  matchId,
  playerId,
  matchPlayerId,
  paymentMethod,
  amountCop,
}: {
  paymentId: string;
  matchId: string;
  playerId: string;
  matchPlayerId: string;
  paymentMethod: string;
  amountCop: number;
}) {
  const supabase = getSupabaseAdminClient();

  await supabase.from("match_players").update({ status: "paid" }).eq("id", matchPlayerId);

  const { data: fillResult } = await supabase.rpc("try_fill_match", { p_match_id: matchId });
  const justFilled = fillResult === "full";

  await supabase.from("analytics_events").insert({
    event_name: "payment_approved",
    user_id: playerId,
    match_id: matchId,
    properties: { payment_method: paymentMethod, provider: "wompi" },
  });

  const { data: matchStatus } = await supabase
    .from("matches")
    .select("status, host_player_id, venue_name, scheduled_at, max_players")
    .eq("id", matchId)
    .maybeSingle();

  const venueName = matchStatus?.venue_name ?? "Tu partido de pádel";
  const scheduledAt = matchStatus?.scheduled_at ?? null;
  const maxPlayers = matchStatus?.max_players ?? APP_CONFIG.maxPlayersPerMatch;

  const { data: joiningProfile } = await supabase
    .from("profiles")
    .select("full_name, phone, whatsapp_phone")
    .eq("id", playerId)
    .maybeSingle();

  const joiningPlayerName = joiningProfile?.full_name ?? "Un jugador";

  const { count: paidCount } = await supabase
    .from("match_players")
    .select("*", { count: "exact", head: true })
    .eq("match_id", matchId)
    .eq("status", "paid");
  const currentPaidCount = paidCount ?? 1;

  const { data: matchPlayer } = await supabase
    .from("match_players")
    .select("is_host")
    .eq("id", matchPlayerId)
    .maybeSingle();
  const isHost = matchPlayer?.is_host ?? false;

  try {
    // The host paying their own first slot already received "partido_creado"
    // when the match was published — don't re-notify. Every other paid join
    // fires "jugador_unido" to the host + existing players.
    if (!(isHost && currentPaidCount === 1)) {
      await notifyOnPlayerJoined({
        matchId,
        newPlayerName: joiningPlayerName,
        newPlayerId: playerId,
        venueName,
        scheduledAt,
        currentPaidCount,
        maxPlayers,
      });
    }
  } catch (err) {
    console.error("[WhatsApp] notification failed after payment", err);
  }

  if (justFilled) {
    try {
      await supabase.from("analytics_events").insert({
        event_name: "organizer_notification_needed",
        match_id: matchId,
      });
      await notifyMatchFull({ matchId, venueName, scheduledAt, maxPlayers });

      if (matchStatus?.host_player_id) {
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
            matchId,
            appUrl,
          });
        }
      }
    } catch (err) {
      console.error("[notifications] match-filled notifications failed", err);
    }

    // #3: avisar al equipo para reservar la cancha en EasyCancha (email con el detalle;
    // el WhatsApp "partido lleno" al owner ya sale arriba). Aislado para no afectar lo demás.
    try {
      await sendCourtBookingHandoff({ matchId, venueName, scheduledAt });
    } catch (err) {
      console.error("[court-booking] handoff failed", err);
    }
  }

  await _sendPaymentEmail(playerId, matchId, amountCop, "approved");
}

async function _sendPaymentEmail(
  playerId: string,
  matchId: string,
  amountCop: number,
  status: "approved" | "declined" | "voided",
) {
  const supabase = getSupabaseAdminClient();
  const [{ data: authUser }, { data: matchInfo }, { data: profile }] = await Promise.all([
    supabase.auth.admin.getUserById(playerId),
    supabase.from("matches").select("venue_name, scheduled_at").eq("id", matchId).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", playerId).maybeSingle(),
  ]);

  if (authUser?.user?.email) {
    await sendPaymentStatusEmail({
      to: authUser.user.email,
      playerName:
        profile?.full_name ??
        (authUser.user.user_metadata?.full_name as string | undefined) ??
        (authUser.user.user_metadata?.first_name as string | undefined) ??
        "Jugador",
      matchVenueName: matchInfo?.venue_name ?? "Tu partido de pádel",
      matchScheduledAt: matchInfo?.scheduled_at ?? null,
      amountCop,
      status,
    });
  }
}
