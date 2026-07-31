/**
 * Tarifario y horario que administra la sede desde su portal.
 * Server-only: escribe con el admin client. La autorización (que la sede solo toque SU
 * `venue_id`) la hacen las rutas usando la sesión firmada; estas tablas son service-role.
 */
import { DAY_TYPES, type DayType } from "@/config/venue-pricing-rules";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  findOverlaps,
  validateRule,
  type VenueHours,
  type VenuePriceRule,
} from "@/services/pricing/venue-rules.helpers";

export type DurationMinutes = 60 | 90 | 120;
export const DURATIONS: readonly DurationMinutes[] = [60, 90, 120] as const;

function hhmm(t: unknown): string {
  return String(t).slice(0, 5);
}

export function isDayType(value: string): value is DayType {
  return (DAY_TYPES as readonly string[]).includes(value);
}

export function isDuration(value: number): value is DurationMinutes {
  return (DURATIONS as readonly number[]).includes(value);
}

/** Todo el tarifario de la sede, para pintar la grilla completa en el portal. */
export async function listVenuePriceRules(venueId: string): Promise<VenuePriceRule[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("venue_price_rules")
    .select("day_type, duration_minutes, start_time, end_time, court_price_cop")
    .eq("venue_id", venueId)
    .order("start_time", { ascending: true });

  if (error) throw new Error("No se pudo cargar el tarifario.");

  return (data ?? []).map((r) => ({
    dayType: r.day_type as DayType,
    durationMinutes: r.duration_minutes as DurationMinutes,
    startTime: hhmm(r.start_time),
    endTime: hhmm(r.end_time),
    courtPriceCop: r.court_price_cop as number,
  }));
}

/**
 * Reemplaza la grilla de un día + duración por la que mandó el portal.
 * Valida cada franja y rechaza solapes: con dos franjas pisadas, el precio de un horario
 * dependería del orden de las filas.
 */
export async function replaceVenuePriceRules(params: {
  venueId: string;
  dayType: DayType;
  durationMinutes: DurationMinutes;
  rules: Array<{ startTime: string; endTime: string; courtPriceCop: number }>;
}): Promise<number> {
  const { venueId, dayType, durationMinutes, rules } = params;

  const normalized: VenuePriceRule[] = rules.map((r) => ({
    dayType,
    durationMinutes,
    startTime: r.startTime,
    endTime: r.endTime,
    courtPriceCop: r.courtPriceCop,
  }));

  for (const rule of normalized) {
    const problem = validateRule(rule);
    if (problem) throw new Error(`${rule.startTime}–${rule.endTime}: ${problem}`);
  }

  const clashes = findOverlaps(normalized);
  if (clashes.length > 0) {
    const [a, b] = clashes[0];
    throw new Error(
      `Las franjas ${a.startTime}–${a.endTime} y ${b.startTime}–${b.endTime} se pisan. Ajustá una de las dos.`,
    );
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("replace_venue_price_rules", {
    p_venue_id: venueId,
    p_day_type: dayType,
    p_duration_minutes: durationMinutes,
    p_rules: normalized.map((r) => ({
      startTime: r.startTime,
      endTime: r.endTime,
      courtPriceCop: r.courtPriceCop,
    })),
  });

  if (error) {
    console.error("[venue-portal] replace_venue_price_rules falló", { venueId, error });
    throw new Error("No se pudo guardar el tarifario. Intentá de nuevo.");
  }

  return (data as number | null) ?? 0;
}

/** Horario de apertura por tipo de día. Devuelve una fila por día, aunque no esté cargada. */
export async function listVenueHours(venueId: string): Promise<VenueHours[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("venue_hours")
    .select("day_type, opens_at, closes_at, is_closed")
    .eq("venue_id", venueId);

  if (error) throw new Error("No se pudo cargar el horario.");

  const byDay = new Map<string, VenueHours>();
  for (const r of data ?? []) {
    byDay.set(r.day_type as string, {
      dayType: r.day_type as DayType,
      opensAt: r.opens_at ? hhmm(r.opens_at) : null,
      closesAt: r.closes_at ? hhmm(r.closes_at) : null,
      isClosed: Boolean(r.is_closed),
    });
  }

  return DAY_TYPES.map(
    (d) => byDay.get(d) ?? { dayType: d, opensAt: null, closesAt: null, isClosed: false },
  );
}

export async function upsertVenueHours(params: {
  venueId: string;
  dayType: DayType;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
}): Promise<void> {
  const { venueId, dayType, opensAt, closesAt, isClosed } = params;

  if (!isClosed) {
    if (!opensAt || !closesAt) {
      throw new Error("Indicá desde y hasta qué hora abrís, o marcá el día como cerrado.");
    }
    if (closesAt <= opensAt) {
      throw new Error("La hora de cierre debe ser posterior a la de apertura.");
    }
  }

  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("venue_hours").upsert(
    {
      venue_id: venueId,
      day_type: dayType,
      opens_at: isClosed ? null : opensAt,
      closes_at: isClosed ? null : closesAt,
      is_closed: isClosed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "venue_id,day_type" },
  );

  if (error) {
    console.error("[venue-portal] upsertVenueHours falló", { venueId, dayType, error });
    throw new Error("No se pudo guardar el horario. Intentá de nuevo.");
  }
}
