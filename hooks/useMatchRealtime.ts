"use client";

import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function useMatchRealtime(matchId: string, onUpdate: () => void) {
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`match-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_players",
          filter: `match_id=eq.${matchId}`,
        },
        () => onUpdate(),
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [matchId, onUpdate]);
}
