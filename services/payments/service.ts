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
import { getAppUrl } from "@/utils/auth-url";
import { getWompiPublicKey, getWompiIntegritySecret, getWompiEventsSecret, getWompiPrivateKey } from "@/utils/env";
import { getErrorMessage } from "@/utils/errors";

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
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
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

// ── Checkout: create DB records + return Wompi params ─────────────────────

export async function createCheckoutForMatch(
  matchId: string,
  options?: { isHost?: boolean },
): Promise<CheckoutResult> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("User is not authenticated");

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("status, org_fee_cop, venue_name, scheduled_at")
    .eq("id", matchId)
    .maybeSingle();
  if (matchError) throw new Error(getErrorMessage(matchError, "No se pudo cargar el partido"));
  if (!match) throw new Error("Partido no encontrado");
  if (match.status !== "open") throw new Error("Este partido ya no acepta jugadores.");
  if (!match.org_fee_cop) {
    throw new Error("Este partido no tiene una tarifa válida. Contacta al organizador.");
  }

  const totalAmountCop = match.org_fee_cop;

  const { count: paidCount, error: paidCountError } = await supabase
    .from("match_players")
    .select("*", { count: "exact", head: true })
    .eq("match_id", matchId)
    .eq("status", "paid");
  if (paidCountError) throw new Error(getErrorMessage(paidCountError, "No se pudo verificar cupos"));
  if ((paidCount ?? 0) >= APP_CONFIG.maxPlayersPerMatch) {
    throw new Error("Este partido ya está completo.");
  }

  const matchPlayerId = await reserveMatchPlayerForCheckout(
    supabase,
    matchId,
    user.id,
    options?.isHost ?? false,
  );

  // Re-use an existing pending checkout if one already exists.
  const { data: existingPayment } = await supabase
    .from("payments")
    .select("id, wompi_reference, amount_cop")
    .eq("match_player_id", matchPlayerId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const appUrl = getAppUrl();
  const publicKey = getWompiPublicKey();
  const integritySecret = getWompiIntegritySecret();
  const redirectUrl = `${appUrl}/matches/${matchId}`;

  if (existingPayment?.wompi_reference) {
    const amountInCents = existingPayment.amount_cop * 100;
    return {
      reference: existingPayment.wompi_reference,
      amountInCents,
      integritySignature: generateWompiIntegrity(
        existingPayment.wompi_reference,
        amountInCents,
        integritySecret,
      ),
      publicKey,
      redirectUrl,
    };
  }

  const reference = crypto.randomUUID();
  const idempotencyKey = crypto.randomUUID();
  const amountInCents = totalAmountCop * 100;

  // Upsert stale pending row or create a new one.
  const { data: stalePending } = await supabase
    .from("payments")
    .select("id")
    .eq("match_player_id", matchPlayerId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const paymentPayload = {
    match_player_id: matchPlayerId,
    match_id: matchId,
    player_id: user.id,
    amount_cop: totalAmountCop,
    status: "pending" as const,
    provider: "wompi",
    wompi_reference: reference,
    idempotency_key: idempotencyKey,
  };

  const { error: paymentError } = stalePending
    ? await supabase.from("payments").update(paymentPayload).eq("id", stalePending.id)
    : await supabase.from("payments").insert(paymentPayload);

  if (paymentError) throw new Error(getErrorMessage(paymentError, "No se pudo registrar el pago"));

  await supabase.from("analytics_events").insert({
    event_name: "checkout_started",
    user_id: user.id,
    match_id: matchId,
    properties: { provider: "wompi" },
  });

  return {
    reference,
    amountInCents,
    integritySignature: generateWompiIntegrity(reference, amountInCents, integritySecret),
    publicKey,
    redirectUrl,
  };
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
  const joiningPlayerPhone =
    joiningProfile?.whatsapp_phone?.trim() || joiningProfile?.phone?.trim() || null;

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
    if (isHost && currentPaidCount === 1) {
      await notifyOwnerNewGame({ matchId, hostName: joiningPlayerName, venueName, scheduledAt });
      if (joiningPlayerPhone) {
        await notifyHostMatchCreated({
          hostPhone: joiningPlayerPhone,
          hostName: joiningPlayerName,
          matchId,
          venueName,
          scheduledAt,
          maxPlayers,
        });
      }
    } else {
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
