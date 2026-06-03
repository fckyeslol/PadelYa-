import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MatchStatus } from "@/types/domain";

export type MatchEarningsRow = {
  matchId: string;
  venueName: string;
  scheduledAt: string;
  status: MatchStatus;
  orgFeeCop: number;
  paidCount: number;
  totalCollectedCop: number;
};

type RawRow = {
  id: string;
  venue_name: string;
  scheduled_at: string;
  status: MatchStatus;
  org_fee_cop: number;
  match_players:
    | { status: string }[]
    | { status: string }
    | null;
};

/** Statuses to surface in the organizer earnings table (live + historical). */
const EARNINGS_STATUSES: MatchStatus[] = [
  "completed",
  "confirmed",
  "full",
  "cancelled_by_organizer",
  "cancelled_unfilled",
];

/**
 * Returns per-match revenue rows, newest first.
 *
 * For each match we count `match_players.status = 'paid'` and multiply by
 * `matches.org_fee_cop` to compute the collected amount. We pull a single
 * round-trip with an embedded relation and aggregate in JS — the dataset is
 * intentionally capped at 50 rows so this stays cheap.
 */
export async function getMatchEarnings(limit = 50): Promise<MatchEarningsRow[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("matches")
    .select(
      `id,
       venue_name,
       scheduled_at,
       status,
       org_fee_cop,
       match_players ( status )`,
    )
    .in("status", EARNINGS_STATUSES)
    .order("scheduled_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return ((data ?? []) as unknown as RawRow[]).map((row): MatchEarningsRow => {
    const players = Array.isArray(row.match_players)
      ? row.match_players
      : row.match_players
        ? [row.match_players]
        : [];
    const paidCount = players.filter((p) => p.status === "paid").length;
    return {
      matchId: row.id,
      venueName: row.venue_name,
      scheduledAt: row.scheduled_at,
      status: row.status,
      orgFeeCop: row.org_fee_cop,
      paidCount,
      totalCollectedCop: paidCount * row.org_fee_cop,
    };
  });
}

/** Sum of `totalCollectedCop` across the rows passed in. */
export function sumEarnings(rows: MatchEarningsRow[]): number {
  let total = 0;
  for (const r of rows) total += r.totalCollectedCop;
  return total;
}
