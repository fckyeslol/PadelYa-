/**
 * Configuración compartida de la integración con EasyCancha.
 *
 * Los IDs de club + sport_id + timespan vivían solo en scripts/easycancha_fetch_4weeks.py.
 * Centralizados acá para que el sync de disponibilidad (services/easycancha) y los
 * scripts usen la misma fuente de verdad.
 */

export const EASYCANCHA_BASE_URL = "https://www.easycancha.com";

/** sport_id de Padel en EasyCancha. */
export const PADEL_SPORT_ID = 7;

export type EasycanchaClub = {
  /** club_id en EasyCancha. */
  id: number;
  /** Nombre tal como lo devuelve la API. */
  name: string;
  /** Slug en config/venues.ts (para cruzar con la metadata de la sede). */
  venueId: string;
  /** Duración del turno en minutos (varía por club). */
  timespan: number;
};

/** Los 6 clubes de pádel de Barranquilla en EasyCancha. */
export const EASYCANCHA_CLUBS: readonly EasycanchaClub[] = [
  { id: 1125, name: "PADEL ZENTER DEL RIO", venueId: "padel-zenter-del-rio", timespan: 90 },
  { id: 1475, name: "PADEL ZENTER LA ARENOSA", venueId: "padel-zenter-la-arenosa", timespan: 90 },
  { id: 1442, name: "Pádel Park Barranquilla", venueId: "padel-park", timespan: 60 },
  { id: 1526, name: "La Jaula Padel Barranquilla", venueId: "la-jaula", timespan: 90 },
  { id: 1675, name: "X3 Pádel Club", venueId: "x3-padel-club", timespan: 90 },
  { id: 1866, name: "Ace Padel Club", venueId: "ace-padel-club", timespan: 90 },
] as const;

export function getEasycanchaClub(clubId: number): EasycanchaClub | undefined {
  return EASYCANCHA_CLUBS.find((c) => c.id === clubId);
}
