import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type PaymentHistoryItem = {
  /** payments.id */
  id: string;
  /** payments.amount_cop */
  amountCop: number;
  /** payments.status — pending | approved | declined | voided | refunded */
  status: "pending" | "approved" | "declined" | "voided" | "refunded";
  /** payments.wompi_reference — UUID emitted to Wompi, displayed in UI */
  wompiReference: string | null;
  /** payments.created_at */
  createdAt: string;
  /** payments.approved_at (nullable) */
  approvedAt: string | null;
  /** payments.payment_method (nullable, e.g. CARD / NEQUI) */
  paymentMethod: string | null;
  /** Joined matches.id via match_players */
  matchId: string;
  /** Joined matches.venue_name */
  venueName: string;
  /** Joined matches.scheduled_at */
  scheduledAt: string;
};

type RawPaymentRow = {
  id: string;
  amount_cop: number;
  status: string;
  wompi_reference: string | null;
  created_at: string;
  approved_at: string | null;
  payment_method: string | null;
  match_players:
    | {
        match_id: string;
        matches:
          | { id: string; venue_name: string; scheduled_at: string }
          | { id: string; venue_name: string; scheduled_at: string }[]
          | null;
      }
    | {
        match_id: string;
        matches:
          | { id: string; venue_name: string; scheduled_at: string }
          | { id: string; venue_name: string; scheduled_at: string }[]
          | null;
      }[]
    | null;
};

const VALID_STATUS = new Set([
  "pending",
  "approved",
  "declined",
  "voided",
  "refunded",
]);

function pickFirst<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return rel[0] ?? null;
  return rel;
}

/**
 * Returns the authenticated player's full payment history, newest first.
 *
 * Auth: we resolve the user via the user-scoped server client (cookies),
 * then read with the admin client to bypass the `matches_read_open_flow`
 * RLS policy — which restricts SELECTs to non-cancelled matches and would
 * silently drop payments tied to cancelled/refunded matches in the join.
 * Authorization is enforced explicitly by `eq('player_id', user.id)`, the
 * same scoping rule as the `payments_select_own` policy.
 */
export async function getPlayerPaymentHistory(
  limit = 100,
): Promise<PaymentHistoryItem[]> {
  const auth = await getSupabaseServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return [];

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("payments")
    .select(
      `id,
       amount_cop,
       status,
       wompi_reference,
       created_at,
       approved_at,
       payment_method,
       match_players!inner (
         match_id,
         matches!inner ( id, venue_name, scheduled_at )
       )`,
    )
    .eq("player_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return ((data ?? []) as unknown as RawPaymentRow[])
    .map((row): PaymentHistoryItem | null => {
      const mp = pickFirst(row.match_players);
      const match = pickFirst(mp?.matches ?? null);
      if (!mp || !match) return null;

      const status = VALID_STATUS.has(row.status)
        ? (row.status as PaymentHistoryItem["status"])
        : "pending";

      return {
        id: row.id,
        amountCop: row.amount_cop,
        status,
        wompiReference: row.wompi_reference,
        createdAt: row.created_at,
        approvedAt: row.approved_at,
        paymentMethod: row.payment_method,
        matchId: mp.match_id,
        venueName: match.venue_name,
        scheduledAt: match.scheduled_at,
      };
    })
    .filter((p): p is PaymentHistoryItem => p !== null);
}
