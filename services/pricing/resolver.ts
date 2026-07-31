/**
 * Tarifa autoritativa por horario. Server-only: lee Supabase con el admin client.
 *
 * Cadena de resolución, de más específica a más general:
 *   1. Tarifario que la SEDE cargó en su portal (`venue_price_rules`)
 *   2. Tarifario estático de `config/venue-pricing-rules.ts`
 *   3. null (la sede no tiene tarifa para ese horario)
 *
 * Este archivo ocupa exactamente el hueco que dejó `services/easycancha/pricing.ts`: la
 * capa async que superpone datos frescos sobre las reglas en código. La diferencia es que
 * ahora el dato lo carga el club, no un scraper.
 *
 * `config/pricing.ts` sigue siendo sincrónico y seguro para el cliente (lo usa MatchForm
 * mientras carga). Todo lo que necesite DB vive acá.
 */
import { getVenueInfo } from "@/config/venues";
import {
  RULE_SLOT_TIMES,
  getAvailableTimeSlotsWithDuration,
  getPlayerFeeByVenueNameWithDuration,
} from "@/config/pricing";
import { COURT_MARKUP_COP, dayType, getCourtCopFromRules } from "@/config/venue-pricing-rules";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  courtPriceAt,
  durationsFromRules,
  isWithinHours,
  playerFeeAt,
  rulesForDay,
  type VenueHours,
  type VenuePriceRule,
} from "./venue-rules.helpers";

type DurationMinutes = 60 | 90 | 120;

function hhmm(t: unknown): string {
  return String(t).slice(0, 5);
}

/** Tarifario que cargó la sede. Vacío si nunca cargó (⇒ se usan las reglas estáticas). */
export async function loadVenuePriceRules(venueId: string): Promise<VenuePriceRule[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("venue_price_rules")
    .select("day_type, duration_minutes, start_time, end_time, court_price_cop")
    .eq("venue_id", venueId);

  if (error) {
    // No se traga: sin esto cobraríamos con el tarifario viejo sin que nadie se entere.
    console.error("[pricing] no se pudo leer venue_price_rules", { venueId, error });
    throw new Error("No se pudo leer el tarifario de la sede.");
  }

  return (data ?? []).map((r) => ({
    dayType: r.day_type as VenuePriceRule["dayType"],
    durationMinutes: r.duration_minutes as DurationMinutes,
    startTime: hhmm(r.start_time),
    endTime: hhmm(r.end_time),
    courtPriceCop: r.court_price_cop as number,
  }));
}

/** Horario de apertura por tipo de día. Vacío = la sede no lo configuró (no filtra). */
export async function loadVenueHours(venueId: string): Promise<VenueHours[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("venue_hours")
    .select("day_type, opens_at, closes_at, is_closed")
    .eq("venue_id", venueId);

  if (error) {
    console.error("[pricing] no se pudo leer venue_hours", { venueId, error });
    throw new Error("No se pudo leer el horario de la sede.");
  }

  return (data ?? []).map((r) => ({
    dayType: r.day_type as VenueHours["dayType"],
    opensAt: r.opens_at ? hhmm(r.opens_at) : null,
    closesAt: r.closes_at ? hhmm(r.closes_at) : null,
    isClosed: Boolean(r.is_closed),
  }));
}

export type ResolvedSlots = {
  /** Horarios candidatos, ya filtrados por el horario de apertura. */
  times: string[];
  /** Tarifa por jugador para cada horario candidato. */
  feeByTime: Record<string, number>;
  /** De dónde salió el tarifario: sirve para avisar en el portal y en logs. */
  source: "venue" | "rules";
};

/**
 * Horarios + tarifas para una sede, fecha y duración.
 * Si la sede cargó tarifario para esa duración, manda el suyo; si no, las reglas.
 */
export async function resolveVenueSlots(
  venueName: string,
  date: string,
  durationMinutes: DurationMinutes,
): Promise<ResolvedSlots> {
  const info = getVenueInfo(venueName);
  if (!info) return { times: [], feeByTime: {}, source: "rules" };

  const day = dayType(date);
  const [venueRules, hoursRows] = await Promise.all([
    loadVenuePriceRules(info.id),
    loadVenueHours(info.id),
  ]);

  const hours = hoursRows.find((h) => h.dayType === day) ?? null;
  const applicable = rulesForDay(venueRules, day).filter(
    (r) => r.durationMinutes === durationMinutes,
  );

  const useVenue = applicable.length > 0;
  const candidates = useVenue
    ? RULE_SLOT_TIMES
    : getAvailableTimeSlotsWithDuration(venueName, date, durationMinutes);

  const times: string[] = [];
  const feeByTime: Record<string, number> = {};

  for (const time of candidates) {
    if (!isWithinHours(hours, time)) continue;
    const fee = useVenue
      ? playerFeeAt(venueRules, day, time, durationMinutes)
      : getPlayerFeeByVenueNameWithDuration(venueName, date, time, durationMinutes);
    if (fee == null) continue;
    times.push(time);
    feeByTime[time] = fee;
  }

  return { times, feeByTime, source: useVenue ? "venue" : "rules" };
}

/**
 * Tarifa autoritativa para UN horario. Es la que se le cobra al jugador y se congela en
 * `matches.org_fee_cop`, así que un cambio de tarifa posterior no altera partidos ya creados.
 */
export async function resolvePlayerFeeCop(
  venueName: string,
  date: string,
  time: string,
  durationMinutes: DurationMinutes,
): Promise<number | null> {
  const info = getVenueInfo(venueName);
  if (!info) return null;

  const venueRules = await loadVenuePriceRules(info.id);
  const venueFee = playerFeeAt(venueRules, dayType(date), time, durationMinutes);
  if (venueFee != null) return venueFee;

  return getPlayerFeeByVenueNameWithDuration(venueName, date, time, durationMinutes);
}

/**
 * Precio de cancha CRUDO — lo que hay que pagarle al club, sin nuestra comisión.
 * Lo usa el aviso de "partido lleno, hay que reservar".
 */
export async function resolveCourtPriceCop(
  venueName: string,
  date: string,
  time: string,
  durationMinutes: DurationMinutes,
): Promise<number | null> {
  const info = getVenueInfo(venueName);
  if (!info) return null;

  const venueRules = await loadVenuePriceRules(info.id);
  const own = courtPriceAt(venueRules, dayType(date), time, durationMinutes);
  if (own != null) return own;

  // Ojo: el `courtCop` del tarifario estático YA trae la comisión sumada; hay que sacarla.
  const ruleCourtCop = getCourtCopFromRules(info.id, date, time, durationMinutes);
  return ruleCourtCop == null ? null : ruleCourtCop - COURT_MARKUP_COP;
}

/**
 * Duraciones que ofrece una sede: las que tarifó ella, o las de las reglas si no cargó nada.
 */
export async function resolveVenueDurations(
  venueName: string,
  fallback: DurationMinutes[],
): Promise<DurationMinutes[]> {
  const info = getVenueInfo(venueName);
  if (!info) return fallback;
  const own = durationsFromRules(await loadVenuePriceRules(info.id));
  return own.length > 0 ? own : fallback;
}
