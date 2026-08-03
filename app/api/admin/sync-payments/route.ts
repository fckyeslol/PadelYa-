/**
 * POST /api/admin/sync-payments
 *
 * Queries Wompi for every payment still marked 'pending' in our DB,
 * then applies the real Wompi status (approved / declined / voided).
 * This recovers payments whose webhook was lost due to a redirect or
 * transient failure.
 *
 * Protected by ADMIN_SECRET header.
 */

import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getWompiPrivateKey } from "@/utils/env";

function getWompiBaseUrl(privateKey: string) {
  return privateKey.startsWith("prv_test_")
    ? "https://sandbox.wompi.co/v1"
    : "https://production.wompi.co/v1";
}

export async function POST(request: Request) {
  const adminSecret = process.env.ADMIN_SECRET;
  const authHeader = request.headers.get("x-admin-secret");
  if (!adminSecret || authHeader !== adminSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const privateKey = getWompiPrivateKey();
  const baseUrl = getWompiBaseUrl(privateKey);
  const supabase = getSupabaseAdminClient();

  // Fetch all payments still pending in our DB.
  const { data: pendingPayments, error } = await supabase
    .from("payments")
    .select("id, wompi_reference, amount_cop, match_player_id, player_id, match_id")
    .eq("status", "pending")
    .not("wompi_reference", "is", null)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Array<{ reference: string; wompiStatus: string | null; action: string }> = [];

  for (const payment of pendingPayments ?? []) {
    const ref = payment.wompi_reference as string;
    try {
      // Query Wompi for transactions with this reference.
      const res = await fetch(
        `${baseUrl}/transactions?reference=${encodeURIComponent(ref)}`,
        { headers: { Authorization: `Bearer ${privateKey}` } },
      );

      if (!res.ok) {
        results.push({ reference: ref, wompiStatus: null, action: `wompi_error_${res.status}` });
        continue;
      }

      const json = (await res.json()) as {
        data: Array<{
          id: string;
          status: string;
          reference: string;
          amount_in_cents: number;
          payment_method_type: string;
          created_at: string;
        }>;
      };

      if (!json.data?.length) {
        results.push({ reference: ref, wompiStatus: null, action: "not_found_in_wompi" });
        continue;
      }

      // Take the most recent transaction for this reference.
      const tx = json.data.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )[0];

      if (tx.status === "PENDING" || tx.status === "ERROR") {
        results.push({ reference: ref, wompiStatus: tx.status, action: "skipped_not_final" });
        continue;
      }

      // Replay a synthetic webhook event so the same business logic applies.
      const syntheticEvent = {
        event: "transaction.updated",
        data: {
          transaction: {
            id: tx.id,
            status: tx.status,
            reference: tx.reference,
            amount_in_cents: tx.amount_in_cents,
            payment_method_type: tx.payment_method_type,
          },
        },
        timestamp: Math.floor(Date.now() / 1000),
        // Skip signature — we're calling this from a trusted internal endpoint.
        _skipSignature: true,
      } as Record<string, unknown>;

      await processWompiWebhookNoSig(syntheticEvent, supabase, payment);
      results.push({ reference: ref, wompiStatus: tx.status, action: "processed" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ reference: ref, wompiStatus: null, action: `error: ${msg}` });
    }
  }

  return NextResponse.json({ synced: results.length, results });
}

/**
 * Lightweight version of processWompiWebhook that skips signature verification
 * since we're calling Wompi's own API to fetch the real status.
 */
async function processWompiWebhookNoSig(
  event: Record<string, unknown>,
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  payment: { id: string; match_player_id: string; player_id: string; match_id: string; amount_cop: number },
) {
  const tx = (event.data as Record<string, unknown>)
    .transaction as Record<string, unknown>;

  const txStatus = tx.status as string;
  const txId = tx.id as string;
  const txMethod = (tx.payment_method_type as string) ?? "";

  const mappedStatus =
    txStatus === "APPROVED"
      ? "approved"
      : txStatus === "PENDING"
        ? "pending"
        : "declined";

  if (mappedStatus === "pending") return;

  const { data: claimed } = await supabase
    .from("payments")
    .update({
      wompi_transaction_id: txId,
      status: mappedStatus,
      payment_method: txMethod,
      approved_at: mappedStatus === "approved" ? new Date().toISOString() : null,
    })
    .eq("id", payment.id)
    .neq("status", "approved")
    .select("id");

  if (!claimed?.length) return;

  if (mappedStatus === "approved") {
    // Update match_player to paid.
    await supabase
      .from("match_players")
      .update({ status: "paid" })
      .eq("id", payment.match_player_id);

    // Try to fill the match.
    await supabase.rpc("try_fill_match", { p_match_id: payment.match_id });

    console.log("[sync-payments] approved", {
      paymentId: payment.id,
      matchId: payment.match_id,
      playerId: payment.player_id,
    });
  } else {
    // Declined — cancel the player slot.
    await supabase
      .from("match_players")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", payment.match_player_id)
      .neq("status", "paid");

    console.log("[sync-payments] declined", { paymentId: payment.id });
  }
}
