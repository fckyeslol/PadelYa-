import pricingData from "@/config/pricing-slots.json";
import { BARRANQUILLA_VENUES, getVenueInfo } from "@/config/venues";
import { RULE_BASED_VENUE_IDS, getPlayerFeeFromRules } from "@/config/venue-pricing-rules";

type SlotOverride = { courtCop: number; playerCop: number };

type PricingSlotsFile = {
  markupCop: number;
  source: string;
  calendarDates: string[];
  byDate: Record<string, Record<string, Record<string, number>>>;
  fixedVenues: {
    "casa-padel": {
      courtCop: number;
      playerCop: number;
      note: string;
      slotOverrides?: Record<string, Record<string, SlotOverride>>;
    };
  };
};

const DATA = pricingData as PricingSlotsFile;

(function checkPricingStaleness() {
  const dates = DATA.calendarDates;
  if (!dates?.length) return;
  const lastDate = dates[dates.length - 1];
  const lastMs = new Date(`${lastDate}T23:59:59-05:00`).getTime();
  const nowMs = Date.now();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  if (nowMs > lastMs) {
    console.error(
      `[pricing] DATOS DE PRECIOS EXPIRADOS — último día: ${lastDate}. Ejecuta "npm run pricing:generate".`,
    );
  } else if (nowMs > lastMs - SEVEN_DAYS_MS) {
    console.warn(
      `[pricing] Los datos de precios expiran pronto (${lastDate}). Ejecuta "npm run pricing:generate".`,
    );
  }
})();

export const COURT_MARKUP_COP = DATA.markupCop;
export const PRICING_SOURCE = DATA.source;
export const PRICING_CALENDAR_DATES = DATA.calendarDates;

export const CASA_PADEL_VENUE_ID = "casa-padel";
export const CASA_PADEL_COURT_COP = DATA.fixedVenues["casa-padel"].courtCop;
export const CASA_PADEL_PLAYER_FEE_COP = DATA.fixedVenues["casa-padel"].playerCop;

const CSV_VENUE_IDS = Object.keys(DATA.byDate);

const STANDARD_SLOT_TIMES = Array.from({ length: 35 }, (_, i) => {
  const totalMinutes = 6 * 60 + i * 30;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${m === 0 ? "00" : "30"}`;
});

export const PRICED_VENUE_IDS = [...CSV_VENUE_IDS, CASA_PADEL_VENUE_ID, ...RULE_BASED_VENUE_IDS];
const PRICED_VENUE_ID_SET = new Set<string>(PRICED_VENUE_IDS);
const RULE_BASED_VENUE_ID_SET = new Set<string>(RULE_BASED_VENUE_IDS);

export const PRICED_VENUE_NAMES = BARRANQUILLA_VENUES.filter((v) =>
  PRICED_VENUE_ID_SET.has(v.id),
).map((v) => v.name);

function isCasaPadelVenueId(venueId: string): boolean {
  return venueId === CASA_PADEL_VENUE_ID;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
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

export function hasCsvPricingForVenueId(venueId: string): boolean {
  return PRICED_VENUE_ID_SET.has(venueId);
}

export function hasCsvPricingForVenueName(venueName: string): boolean {
  const info = getVenueInfo(venueName);
  return info != null && hasCsvPricingForVenueId(info.id);
}

/** Fechas con datos en el CSV (EasyCancha scrape). */
export function getPricingCalendarDates(): string[] {
  return [...PRICING_CALENDAR_DATES];
}

/** Horarios con fila en el CSV para club + fecha exacta. */
export function getAvailableTimeSlots(venueId: string, date: string): string[] {
  if (isCasaPadelVenueId(venueId)) return [...STANDARD_SLOT_TIMES];
  const map = DATA.byDate[venueId]?.[date];
  if (!map) return [];
  return Object.keys(map).sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
}

export function getAvailableTimeSlotsByVenueName(venueName: string, date: string): string[] {
  const info = getVenueInfo(venueName);
  if (!info || !hasCsvPricingForVenueId(info.id)) return [];
  return getAvailableTimeSlots(info.id, date);
}

/** Precio cancha: fila exacta del CSV (+ markup) para fecha y hora. */
export function getCourtPriceCop(venueId: string, date: string, time: string): number | null {
  if (isCasaPadelVenueId(venueId)) {
    const override = DATA.fixedVenues["casa-padel"].slotOverrides?.[date]?.[time];
    return override ? override.courtCop : CASA_PADEL_COURT_COP;
  }
  const price = DATA.byDate[venueId]?.[date]?.[time];
  return price ?? null;
}

export function getPlayerFeeCop(venueId: string, date: string, time: string): number | null {
  if (isCasaPadelVenueId(venueId)) {
    const override = DATA.fixedVenues["casa-padel"].slotOverrides?.[date]?.[time];
    return override ? override.playerCop : CASA_PADEL_PLAYER_FEE_COP;
  }
  const court = getCourtPriceCop(venueId, date, time);
  if (court === null) return null;
  return Math.round(court / 4);
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
  const fee = getPlayerFeeByVenueName(venueName, date, time);
  if (fee === null) {
    throw new Error(
      `No hay tarifa en el CSV para "${venueName}" el ${date} a las ${time}. Elige fecha y hora disponibles en EasyCancha.`,
    );
  }
  return fee;
}

export function resolveDisplayFeeCop(venueName: string, scheduledAt: string): number | null {
  const { date, time } = bogotaDateAndTime(scheduledAt);
  return getPlayerFeeByVenueName(venueName, date, time);
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

export function getAvailableTimeSlotsWithDuration(
  venueName: string,
  date: string,
  durationMinutes: 60 | 90,
): string[] {
  const info = getVenueInfo(venueName);
  if (!info) return [];
  if (isRuleBasedVenueId(info.id)) {
    return STANDARD_SLOT_TIMES.filter(
      (time) => getPlayerFeeFromRules(info.id, date, time, durationMinutes) !== null,
    );
  }
  return getAvailableTimeSlots(info.id, date);
}

export function getPlayerFeeByVenueNameWithDuration(
  venueName: string,
  date: string,
  time: string,
  durationMinutes: 60 | 90,
): number | null {
  const info = getVenueInfo(venueName);
  if (!info) return null;
  if (isRuleBasedVenueId(info.id)) {
    return getPlayerFeeFromRules(info.id, date, time, durationMinutes);
  }
  return getPlayerFeeCop(info.id, date, time);
}
