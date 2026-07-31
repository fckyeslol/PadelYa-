/**
 * Lógica pura del tarifario administrado por la sede. Sin DB, sin red — para poder
 * testearla sola y para que la use tanto el resolver del servidor como la validación
 * de las rutas del portal.
 */
import { toMinutes, playerFeeFromCourtPrice } from "@/config/venue-pricing-rules";
import type { DayType } from "@/config/venue-pricing-rules";

export type VenuePriceRule = {
  dayType: DayType;
  durationMinutes: 60 | 90 | 120;
  /** "HH:MM" inclusive */
  startTime: string;
  /** "HH:MM" exclusive */
  endTime: string;
  /** Lo que cobra el club por la cancha, sin nuestra comisión. */
  courtPriceCop: number;
};

export type VenueHours = {
  dayType: DayType;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
};

/**
 * Las reglas de viernes caen a las de lunes-a-jueves cuando la sede no cargó viernes,
 * igual que el tarifario estático. Así una sede puede cargar solo "entre semana".
 */
export function rulesForDay<T extends { dayType: DayType }>(rules: T[], day: DayType): T[] {
  const exact = rules.filter((r) => r.dayType === day);
  if (exact.length > 0) return exact;
  return day === "friday" ? rules.filter((r) => r.dayType === "weekday") : [];
}

/** Precio de cancha para un horario puntual, o null si ninguna franja lo cubre. */
export function courtPriceAt(
  rules: VenuePriceRule[],
  day: DayType,
  time: string,
  durationMinutes: 60 | 90 | 120,
): number | null {
  const t = toMinutes(time);
  for (const r of rulesForDay(rules, day)) {
    if (r.durationMinutes !== durationMinutes) continue;
    if (t >= toMinutes(r.startTime) && t < toMinutes(r.endTime)) return r.courtPriceCop;
  }
  return null;
}

/** Tarifa por jugador para un horario puntual, o null si no hay franja que lo cubra. */
export function playerFeeAt(
  rules: VenuePriceRule[],
  day: DayType,
  time: string,
  durationMinutes: 60 | 90 | 120,
): number | null {
  const court = courtPriceAt(rules, day, time, durationMinutes);
  return court === null ? null : playerFeeFromCourtPrice(court);
}

/** Duraciones que la sede tarifó, en cualquier día. Vacío si no cargó nada. */
export function durationsFromRules(rules: VenuePriceRule[]): (60 | 90 | 120)[] {
  return [...new Set(rules.map((r) => r.durationMinutes))].sort((a, b) => a - b);
}

/**
 * true si `time` cae dentro del horario de apertura de ese día.
 * Sin horario cargado ⇒ true (no filtra): una sede que no configuró horarios no debe
 * quedarse sin turnos.
 */
export function isWithinHours(hours: VenueHours | null | undefined, time: string): boolean {
  if (!hours) return true;
  if (hours.isClosed) return false;
  if (!hours.opensAt || !hours.closesAt) return true;
  const t = toMinutes(time);
  return t >= toMinutes(hours.opensAt) && t < toMinutes(hours.closesAt);
}

/**
 * Franjas que se pisan entre sí para el mismo día + duración. Se usa para rechazar
 * guardados ambiguos: con dos franjas solapadas, el precio de un horario dependería
 * del orden de las filas.
 */
export function findOverlaps(rules: VenuePriceRule[]): [VenuePriceRule, VenuePriceRule][] {
  const clashes: [VenuePriceRule, VenuePriceRule][] = [];
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const a = rules[i];
      const b = rules[j];
      if (a.dayType !== b.dayType || a.durationMinutes !== b.durationMinutes) continue;
      if (toMinutes(a.startTime) < toMinutes(b.endTime) && toMinutes(b.startTime) < toMinutes(a.endTime)) {
        clashes.push([a, b]);
      }
    }
  }
  return clashes;
}

/** Valida una franja suelta antes de guardarla. Devuelve el error o null si está bien. */
export function validateRule(rule: VenuePriceRule): string | null {
  if (!/^\d{2}:\d{2}$/.test(rule.startTime) || !/^\d{2}:\d{2}$/.test(rule.endTime)) {
    return "Las horas deben tener formato HH:MM.";
  }
  if (toMinutes(rule.endTime) <= toMinutes(rule.startTime)) {
    return "La hora de fin debe ser posterior a la de inicio.";
  }
  if (!Number.isInteger(rule.courtPriceCop) || rule.courtPriceCop <= 0) {
    return "El precio de la cancha debe ser un número mayor a cero.";
  }
  if (rule.courtPriceCop > 2_000_000) {
    return "Ese precio parece un error: el máximo permitido es $2.000.000.";
  }
  return null;
}
