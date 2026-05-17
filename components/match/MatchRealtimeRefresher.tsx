"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useMatchRealtime } from "@/hooks/useMatchRealtime";

export function MatchRealtimeRefresher({ matchId }: { matchId: string }) {
  const router = useRouter();
  const refreshPage = useCallback(() => {
    router.refresh();
  }, [router]);

  useMatchRealtime(matchId, refreshPage);
  return null;
}
