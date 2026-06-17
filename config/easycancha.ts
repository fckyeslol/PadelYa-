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

/**
 * Ventana "caliente": días hacia adelante que las 6 cuentas mantienen frescos en
 * cada visita. Fechas más lejanas se traen on-demand cuando un usuario las elige.
 */
export const HOT_WINDOW_DAYS = 3;

/** Intervalos (min) entre turnos de una misma cuenta; se elige uno al azar por turno. */
export const SYNC_INTERVALS_MIN = [30, 45, 60] as const;

/** Jitter extra (± min) sobre el intervalo elegido, para no ser metronómico. */
export const SYNC_INTERVAL_JITTER_MIN = 5;

/**
 * Ventana de silencio (madrugada Bogotá): el heartbeat NO scrapea entre estas horas para
 * darle a las cuentas un ritmo diurno humano (nadie consulta disponibilidad a las 3am todos
 * los días). Hora local Colombia (UTC-5, sin DST). Rango [start, end): 1 = 01:00, 6 = 06:00.
 * El top-up on-demand (disparado por un usuario real) NO se pausa.
 */
export const QUIET_HOURS_START = 1;
export const QUIET_HOURS_END = 6;

/** Al reanudar tras la ventana, repartir el arranque de las cuentas en esta franja (min). */
export const MORNING_RESUME_SPREAD_MIN = 60;

/** Top-up on-demand: timeout corto (la creación de partido no debe colgarse). */
export const ON_DEMAND_TIMEOUT_MS = 4_000;

/**
 * Presupuesto global de fetches on-demand en vivo (token-bucket). Pasado el tope,
 * las fechas extra caen en fail-open: no se llama a EasyCancha.
 */
export const ON_DEMAND_BUDGET_CAPACITY = 12;
export const ON_DEMAND_BUDGET_REFILL_PER_MIN = 12;

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
