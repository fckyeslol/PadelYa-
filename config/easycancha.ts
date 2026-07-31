/**
 * Deep links a EasyCancha. NO hay integración: el scraping se eliminó el 2026-07-30
 * (8 cuentas baneadas; ver el commit que borró services/easycancha/).
 *
 * Lo único que queda es el mapeo sede → club_id para armar la URL de reserva que va
 * en el aviso de "partido lleno, hay que reservar la cancha". La reserva siempre fue
 * manual, así que esto es un hipervínculo, no una integración.
 */

export const EASYCANCHA_BASE_URL = "https://www.easycancha.com";

/** sport_id de Padel en EasyCancha (parámetro de la URL de reserva). */
export const PADEL_SPORT_ID = 7;

/** Sedes de Barranquilla que se reservan por EasyCancha, por slug de config/venues.ts. */
const CLUB_ID_BY_VENUE_ID: Readonly<Record<string, number>> = {
  "padel-zenter-del-rio": 1125,
  "padel-zenter-la-arenosa": 1475,
  "padel-park": 1442,
  "la-jaula": 1526,
  "x3-padel-club": 1675,
  "ace-padel-club": 1866,
};

/** club_id de EasyCancha para una sede, o null si no se reserva ahí (ej. Casa Padel). */
export function easycanchaClubIdForVenueId(venueId: string): number | null {
  return CLUB_ID_BY_VENUE_ID[venueId] ?? null;
}

/** URL de la página de reserva del club en EasyCancha. */
export function easycanchaBookingUrl(clubId: number): string {
  return `${EASYCANCHA_BASE_URL}/book/clubs/${clubId}/sports?sportId=${PADEL_SPORT_ID}&lang=es-CO&country=CO`;
}
