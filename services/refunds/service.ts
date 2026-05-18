import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { RefundRow } from "@/components/organizer/OrganizerRefundTable";

export async function listAllRefunds(): Promise<RefundRow[]> {
  const admin = getSupabaseAdminClient();

  // Fetch refunds with payment info
  const { data: refunds, error: refundsError } = await admin
    .from("refunds")
    .select("id, status, amount_cop, reason, payment_id")
    .order("created_at", { ascending: false })
    .limit(100);

  if (refundsError) throw refundsError;
  if (!refunds || refunds.length === 0) return [];

  const paymentIds = refunds.map((r) => r.payment_id);

  const { data: payments, error: paymentsError } = await admin
    .from("payments")
    .select("id, player_id, match_id")
    .in("id", paymentIds);

  if (paymentsError) throw paymentsError;

  const playerIds = [...new Set((payments ?? []).map((p) => p.player_id))];
  const matchIds = [...new Set((payments ?? []).map((p) => p.match_id))];

  const [profilesResult, matchesResult] = await Promise.all([
    admin.from("profiles").select("id, full_name").in("id", playerIds),
    admin.from("matches").select("id, venue_name").in("id", matchIds),
  ]);

  const profileMap = new Map((profilesResult.data ?? []).map((p) => [p.id, p.full_name as string]));
  const matchMap = new Map((matchesResult.data ?? []).map((m) => [m.id, m.venue_name as string]));
  const paymentMap = new Map((payments ?? []).map((p) => [p.id, p]));

  return refunds.map((r) => {
    const payment = paymentMap.get(r.payment_id);
    return {
      id: r.id,
      status: r.status,
      amount_cop: r.amount_cop,
      reason: r.reason,
      playerName: payment ? (profileMap.get(payment.player_id) ?? "Jugador") : "Jugador",
      venueName: payment ? (matchMap.get(payment.match_id) ?? "Partido") : "Partido",
      matchId: payment?.match_id ?? "",
    };
  });
}
