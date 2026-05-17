import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AnalyticsEvent } from "@/types/domain";

export async function trackEvent(event: AnalyticsEvent) {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("analytics_events").insert({
    event_name: event.eventName,
    user_id: event.userId ?? null,
    match_id: event.matchId ?? null,
    properties: event.properties ?? {},
  });

  if (error) {
    throw error;
  }
}

export async function getOrganizerKpis() {
  const supabase = await getSupabaseServerClient();

  const [funnel, conversion, revenue, repeatPlayers] = await Promise.all([
    supabase.from("v_matches_funnel").select("*").order("week_start", { ascending: false }).limit(8),
    supabase.from("v_payment_conversion").select("*").order("week_start", { ascending: false }).limit(8),
    supabase.from("v_organizer_revenue").select("*").order("week_start", { ascending: false }).limit(8),
    supabase.from("v_repeat_players").select("*").maybeSingle(),
  ]);

  if (funnel.error) throw funnel.error;
  if (conversion.error) throw conversion.error;
  if (revenue.error) throw revenue.error;
  if (repeatPlayers.error) throw repeatPlayers.error;

  return {
    funnel: funnel.data ?? [],
    conversion: conversion.data ?? [],
    revenue: revenue.data ?? [],
    repeatPlayers: repeatPlayers.data,
  };
}
