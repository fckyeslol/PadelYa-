/**
 * Pricing EN VIVO desde easycancha_slots, con las reglas en código como fallback.
 *
 * Fuente de verdad del precio = `easycancha_slots.price_cop` (cancha cruda scrapeada).
 * Tarifa jugador = (price_cop + COURT_MARKUP_COP) / 4 + PLAYER_FEE_SURCHARGE_COP.
 *
 * Cae a las reglas (`config/venue-pricing-rules.ts`, date-independent, nunca vencen)
 * cuando no hay dato en vivo: fecha fuera de la ventana caliente, duración distinta al
 * timespan nativo del club, o el scraping caído (data stale ⇒ se ignora). Así un outage
 * de scraping NO deja el cobro sin precio.
 *
 * Server-only: lee Supabase con el admin client.
 */
import { EASYCANCHA_CLUBS } from "@/config/easycancha";
import { getVenueInfo } from "@/config/venues";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPlayerFeeByVenueNameWithDuration } from "@/config/pricing";
import { COURT_MARKUP_COP, PLAYER_FEE_SURCHARGE_COP } from "@/config/venue-pricing-rules";

// Data más vieja que esto se trata como "sin datos" ⇒ fallback a reglas (mismo criterio
// que availability.ts: no cobrar/mostrar con precios stale si el sync se cayó).
const MAX_STALENESS_MS = 2 * 60 * 60 * 1000; // 2 horas

type Club = { id: number; timespan: number };

function clubForVenueName(venueName: string): Club | null {
  const info = getVenueInfo(venueName);
  if (!info) return null;
  const club = EASYCANCHA_CLUBS.find((c) => c.venueId === info.id);
  return club ? { id: club.id, timespan: club.timespan } : null;
}

/** Tarifa por jugador a partir del precio de cancha crudo (con comisión). */
function playerFeeFromRawCourt(priceCop: number): number {
  return Math.round((priceCop + COURT_MARKUP_COP) / 4) + PLAYER_FEE_SURCHARGE_COP;
}

/**
 * Mapa "HH:MM" → tarifa jugador EN VIVO para sede + fecha + duración.
 * Vacío si: la sede no está en EasyCancha, la duración pedida no es el timespan nativo
 * del club, no hay filas para esa fecha, o la data está stale (sync caído).
 * Una sola query.
 */
export async function getLivePlayerFeesByTime(
  venueName: string,
  date: string,
  durationMinutes: 60 | 90 | 120,
): Promise<Map<string, number>> {
  const club = clubForVenueName(venueName);
  // En vivo solo cubre el timespan nativo scrapeado; otras duraciones → reglas.
  if (!club || club.timespan !== durationMinutes) return new Map();

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("easycancha_slots")
    .select("start_time, price_cop, captured_at")
    .eq("club_id", club.id)
    .eq("slot_date", date);

  if (error || !data || data.length === 0) return new Map();

  const freshest = Math.max(...data.map((r) => new Date(r.captured_at as string).getTime()));
  if (Date.now() - freshest > MAX_STALENESS_MS) return new Map();

  const fees = new Map<string, number>();
  for (const row of data) {
    const price = row.price_cop as number | null;
    if (price == null || price <= 0) continue;
    const hhmm = String(row.start_time).slice(0, 5);
    if (!fees.has(hhmm)) fees.set(hhmm, playerFeeFromRawCourt(price));
  }
  return fees;
}

/**
 * Tarifa por jugador autoritativa: precio EN VIVO si hay dato fresco; si no, reglas/Casa Padel.
 * Devuelve null solo si la sede no tiene pricing por ningún medio.
 */
export async function resolvePlayerFeeCop(
  venueName: string,
  date: string,
  time: string,
  durationMinutes: 60 | 90 | 120,
): Promise<number | null> {
  const liveFees = await getLivePlayerFeesByTime(venueName, date, durationMinutes);
  const liveFee = liveFees.get(time.slice(0, 5));
  if (liveFee != null) return liveFee;
  return getPlayerFeeByVenueNameWithDuration(venueName, date, time, durationMinutes);
}
