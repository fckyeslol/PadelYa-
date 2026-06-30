import { EASYCANCHA_CLUBS } from "@/config/easycancha";
import { BARRANQUILLA_VENUES, getVenueInfo } from "@/config/venues";
import {
  RULE_BASED_VENUE_IDS,
  getPlayerFeeFromRules,
  getAvailableDurations,
  PLAYER_FEE_SURCHARGE_COP,
  COURT_MARKUP_COP,
} from "@/config/venue-pricing-rules";

/** Duración nativa (timespan) scrapeada por EasyCancha para una sede, o null. */
function easycanchaNativeTimespan(venueId: string): 60 | 90 | 120 | null {
  const club = EASYCANCHA_CLUBS.find((c) => c.venueId === venueId);
  if (!club) return null;
  return club.timespan === 60 ? 60 : club.timespan === 120 ? 120 : 90;
}

export { COURT_MARKUP_COP };

// ─── Casa Padel: tarifa fija (ReservaDeportes, no EasyCancha) ────────────────
// No se scrapea, así que vive como constante (antes en pricing-slots.json).
export const CASA_PADEL_VENUE_ID = "casa-padel";
export const CASA_PADEL_COURT_COP = 92_500;
export const CASA_PADEL_PLAYER_FEE_COP = 23_125;

const STANDARD_SLOT_TIMES = Array.from({ length: 35 }, (_, i) => {
  const totalMinutes = 6 * 60 + i * 30;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${m === 0 ? "00" : "30"}`;
});

// Sedes con tarifa: las 6 de EasyCancha (rule-based) + Casa Padel (fija).
export const PRICED_VENUE_IDS = [...RULE_BASED_VENUE_IDS, CASA_PADEL_VENUE_ID];
const PRICED_VENUE_ID_SET = new Set<string>(PRICED_VENUE_IDS);
const RULE_BASED_VENUE_ID_SET = new Set<string>(RULE_BASED_VENUE_IDS);

export const PRICED_VENUE_NAMES = BARRANQUILLA_VENUES.filter((v) =>
  PRICED_VENUE_ID_SET.has(v.id),
).map((v) => v.name);

function isCasaPadelVenueId(venueId: string): boolean {
  return venueId === CASA_PADEL_VENUE_ID;
}

/** Fecha y hora en America/Bogota para un ISO guardado. */
export function bogotaDateAndTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = d.toLocaleString("sv-SE", { timeZone: "America/Bogota" }).slice(0, 10);
  const time = d
    .toLocaleString("en-GB", {
      timeZone: "America/Bogota",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .slice(0, 5);
  return { date, time };
}

/** true si la sede tiene tarifa fija no-EasyCancha (hoy: solo Casa Padel). */
export function hasCsvPricingForVenueId(venueId: string): boolean {
  return isCasaPadelVenueId(venueId);
}

export function hasCsvPricingForVenueName(venueName: string): boolean {
  const info = getVenueInfo(venueName);
  return info != null && hasCsvPricingForVenueId(info.id);
}

// Días hacia adelante que ofrece el calendario (antes lo fijaba el CSV). El pricing es
// date-independent (reglas) + en vivo, así que basta una ventana móvil desde hoy.
const CALENDAR_DAYS_AHEAD = 30;

/** Fechas seleccionables (Bogotá): hoy + CALENDAR_DAYS_AHEAD días. */
export function getPricingCalendarDates(): string[] {
  const todayStr = new Date().toLocaleString("sv-SE", { timeZone: "America/Bogota" }).slice(0, 10);
  const [y, m, d] = todayStr.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  const out: string[] = [];
  for (let i = 0; i < CALENDAR_DAYS_AHEAD; i++) {
    const dt = new Date(base);
    dt.setUTCDate(base.getUTCDate() + i);
    out.push(dt.toISOString().slice(0, 10));
  }
  return out;
}

/** Horarios estándar para sedes de tarifa fija (Casa Padel). EasyCancha usa reglas. */
export function getAvailableTimeSlots(venueId: string, _date: string): string[] {
  if (isCasaPadelVenueId(venueId)) return [...STANDARD_SLOT_TIMES];
  return [];
}

export function getAvailableTimeSlotsByVenueName(venueName: string, date: string): string[] {
  const info = getVenueInfo(venueName);
  if (!info || !hasCsvPricingForVenueId(info.id)) return [];
  return getAvailableTimeSlots(info.id, date);
}

/** Precio de cancha (fallback sync). Casa Padel = fijo; EasyCancha → null (usar reglas/vivo). */
export function getCourtPriceCop(venueId: string, _date: string, _time: string): number | null {
  if (isCasaPadelVenueId(venueId)) return CASA_PADEL_COURT_COP;
  return null;
}

export function getPlayerFeeCop(venueId: string, _date: string, _time: string): number | null {
  if (isCasaPadelVenueId(venueId)) return CASA_PADEL_PLAYER_FEE_COP + PLAYER_FEE_SURCHARGE_COP;
  return null;
}

export function getPlayerFeeByVenueName(
  venueName: string,
  date: string,
  time: string,
): number | null {
  const info = getVenueInfo(venueName);
  if (!info || !hasCsvPricingForVenueId(info.id)) return null;
  return getPlayerFeeCop(info.id, date, time);
}

export function resolveOrgFeeCopForMatch(venueName: string, scheduledAt: string): number {
  const { date, time } = bogotaDateAndTime(scheduledAt);
  const fee = getPlayerFeeByVenueNameWithDuration(venueName, date, time, 90);
  if (fee === null) {
    throw new Error(
      `No hay tarifa para "${venueName}" el ${date} a las ${time}. Elige fecha y hora disponibles.`,
    );
  }
  return fee;
}

export function resolveDisplayFeeCop(
  venueName: string,
  scheduledAt: string,
  durationMinutes: 60 | 90 | 120 = 90,
): number | null {
  const { date, time } = bogotaDateAndTime(scheduledAt);
  return getPlayerFeeByVenueNameWithDuration(venueName, date, time, durationMinutes);
}

export function isRuleBasedVenueId(venueId: string): boolean {
  return RULE_BASED_VENUE_ID_SET.has(venueId);
}

export function isRuleBasedVenueName(venueName: string): boolean {
  const info = getVenueInfo(venueName);
  return info != null && isRuleBasedVenueId(info.id);
}

export function hasPricingForVenueName(venueName: string): boolean {
  return hasCsvPricingForVenueName(venueName) || isRuleBasedVenueName(venueName);
}

export function getAvailableDurationsForVenue(venueName: string): (60 | 90 | 120)[] {
  const info = getVenueInfo(venueName);
  if (!info) return [];
  const durations = new Set<60 | 90 | 120>();
  if (isRuleBasedVenueId(info.id)) {
    for (const d of getAvailableDurations(info.id)) durations.add(d);
  }
  // La duración nativa de EasyCancha siempre se ofrece: el precio sale EN VIVO de
  // easycancha_slots aunque no haya regla para esa duración (ej. Padel Park 60 min).
  const nativeTimespan = easycanchaNativeTimespan(info.id);
  if (nativeTimespan) durations.add(nativeTimespan);
  if (info.id === CASA_PADEL_VENUE_ID) durations.add(90);
  if (durations.size === 0) return [];
  return [...durations].sort((a, b) => a - b);
}

export function getAvailableTimeSlotsWithDuration(
  venueName: string,
  date: string,
  durationMinutes: 60 | 90 | 120,
): string[] {
  const info = getVenueInfo(venueName);
  if (!info) return [];
  if (isRuleBasedVenueId(info.id)) {
    const ruleSlots = STANDARD_SLOT_TIMES.filter(
      (time) => getPlayerFeeFromRules(info.id, date, time, durationMinutes) !== null,
    );
    if (ruleSlots.length > 0) return ruleSlots;
  }
  if (info.id === CASA_PADEL_VENUE_ID) {
    return getAvailableTimeSlots(info.id, date);
  }
  return [];
}

export function getPlayerFeeByVenueNameWithDuration(
  venueName: string,
  date: string,
  time: string,
  durationMinutes: 60 | 90 | 120,
): number | null {
  const info = getVenueInfo(venueName);
  if (!info) return null;
  if (isRuleBasedVenueId(info.id)) {
    const ruleFee = getPlayerFeeFromRules(info.id, date, time, durationMinutes);
    if (ruleFee !== null) return ruleFee;
  }
  if (info.id === CASA_PADEL_VENUE_ID) {
    return getPlayerFeeCop(info.id, date, time);
  }
  return null;
}
