/**
 * Tope de creación de partidos según la disponibilidad real de EasyCancha.
 *
 * Regla (definida con el usuario): en una sede+fecha+hora, la cantidad de partidos
 * que se pueden crear en PadelYa = canchas libres en EasyCancha − partidos PadelYa
 * ya activos en ese horario. 0 → no se puede crear.
 *
 * Sin datos de EasyCancha (sede fuera de EasyCancha, fecha no sincronizada, o cron
 * caído) ⇒ fail-open: no bloquea. Esto NO genera tráfico hacia EasyCancha: lee la
 * tabla easycancha_slots (Supabase), que el cron alimenta cada pocos minutos.
 */
import { EASYCANCHA_CLUBS } from "@/config/easycancha";
import { getVenueInfo } from "@/config/venues";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/** club_id de EasyCancha para una sede de PadelYa, o null si la sede no está en EasyCancha. */
export function easycanchaClubIdForVenueName(venueName: string): number | null {
  const info = getVenueInfo(venueName);
  if (!info) return null;
  return EASYCANCHA_CLUBS.find((c) => c.venueId === info.id)?.id ?? null;
}

export type EasycanchaDayAvailability = {
  /** false = no tenemos datos para esa sede/fecha ⇒ fail-open (no bloquear). */
  hasData: boolean;
  /** canchas libres en EasyCancha por hora "HH:MM". */
  freeByTime: Map<string, number>;
};

const NO_DATA: EasycanchaDayAvailability = { hasData: false, freeByTime: new Map() };

// Si el sync se cae (cron apagado, cuenta bloqueada, etc.) NO gateamos con data vieja:
// pasada esta antigüedad, tratamos la disponibilidad como "sin datos" ⇒ fail-open.
const MAX_STALENESS_MS = 2 * 60 * 60 * 1000; // 2 horas

/** Canchas libres en EasyCancha por horario, para una sede + fecha (1 query). */
export async function getEasycanchaDayAvailability(
  venueName: string,
  date: string,
): Promise<EasycanchaDayAvailability> {
  const clubId = easycanchaClubIdForVenueName(venueName);
  if (clubId == null) return NO_DATA; // sede fuera de EasyCancha (ej. Casa Padel)

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("easycancha_slots")
    .select("start_time, is_free, captured_at")
    .eq("club_id", clubId)
    .eq("slot_date", date);

  // error o cero filas ⇒ esa fecha no está sincronizada ⇒ fail-open.
  if (error || !data || data.length === 0) return NO_DATA;

  // data vieja (sync caído) ⇒ no gatear con info stale ⇒ fail-open.
  const freshest = Math.max(...data.map((r) => new Date(r.captured_at as string).getTime()));
  if (Date.now() - freshest > MAX_STALENESS_MS) return NO_DATA;

  const freeByTime = new Map<string, number>();
  for (const row of data) {
    if (!row.is_free) continue;
    const hhmm = String(row.start_time).slice(0, 5);
    freeByTime.set(hhmm, (freeByTime.get(hhmm) ?? 0) + 1);
  }
  return { hasData: true, freeByTime };
}

/**
 * Cupos creables en PadelYa para un horario según EasyCancha.
 * Devuelve null cuando no hay datos (fail-open). Si hay datos: max(0, libres − activos).
 */
export function easycanchaCreatableCap(
  availability: EasycanchaDayAvailability,
  time: string,
  activePadelyaMatches: number,
): number | null {
  if (!availability.hasData) return null;
  const free = availability.freeByTime.get(time) ?? 0;
  return Math.max(0, free - activePadelyaMatches);
}
