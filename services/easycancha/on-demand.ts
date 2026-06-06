/**
 * Top-up on-demand de disponibilidad: cuando un usuario elige una fecha fuera de la
 * ventana caliente y no tenemos data fresca, traemos ESE club+fecha en el momento
 * (1 request). Con candados para que un usuario clickeando muchas fechas no genere una
 * ráfaga contra EasyCancha:
 *
 *   1. Debounce  -> en el cliente (MatchForm): no dispara en cada click.
 *   2. Cache     -> la propia tabla easycancha_slots; misma fecha = 1 request.
 *   3. Bucket    -> presupuesto global de fetches en vivo; pasado el tope, fail-open.
 *   4. Dedup     -> si ya hay un fetch en curso para ese club+fecha, se cuelga del mismo.
 *
 * Siempre degrada a fail-open: si no hay token, se acaba el bucket o falla/timeout el
 * fetch, no bloquea — el gating simplemente no aplica para esa fecha.
 */
import {
  getEasycanchaClub,
  ON_DEMAND_BUDGET_CAPACITY,
  ON_DEMAND_BUDGET_REFILL_PER_MIN,
  ON_DEMAND_TIMEOUT_MS,
} from "@/config/easycancha";
import { easycanchaClubIdForVenueName } from "./availability";
import { getAnyValidSession } from "./client";
import { syncClubForDates } from "./sync";

// --- Candado 3: token-bucket global (por instancia serverless). ---
let tokens = ON_DEMAND_BUDGET_CAPACITY;
let lastRefill = Date.now();

function takeToken(): boolean {
  const now = Date.now();
  const refill = ((now - lastRefill) / 60_000) * ON_DEMAND_BUDGET_REFILL_PER_MIN;
  if (refill >= 1) {
    tokens = Math.min(ON_DEMAND_BUDGET_CAPACITY, tokens + Math.floor(refill));
    lastRefill = now;
  }
  if (tokens <= 0) return false;
  tokens -= 1;
  return true;
}

// --- Candado 4: dedup de fetches en vuelo por club+fecha. ---
const inFlight = new Map<string, Promise<void>>();

async function doFetch(clubId: number, date: string): Promise<void> {
  const club = getEasycanchaClub(clubId);
  if (!club) return;
  const session = await getAnyValidSession();
  if (!session) return; // sin token -> fail-open

  // Sin pace (1 sola fecha) y con timeout corto: la creación de partido no se cuelga.
  await syncClubForDates(club, [date], session, { timeoutMs: ON_DEMAND_TIMEOUT_MS });
}

/**
 * Asegura data fresca para una sede+fecha antes de aplicar el gating. No-op silencioso
 * si la sede no está en EasyCancha, si no hay presupuesto, o si algo falla (fail-open).
 * Llamar SOLO cuando ya se sabe que no hay data fresca en DB (evita gastar bucket al pedo).
 */
export async function ensureFreshAvailability(venueName: string, date: string): Promise<void> {
  const clubId = easycanchaClubIdForVenueName(venueName);
  if (clubId == null) return;

  const key = `${clubId}|${date}`;
  const existing = inFlight.get(key);
  if (existing) {
    await existing;
    return;
  }

  if (!takeToken()) return; // presupuesto agotado -> fail-open

  const p = doFetch(clubId, date)
    .catch(() => {
      /* fail-open: nunca propagar al flujo de creación */
    })
    .finally(() => {
      inFlight.delete(key);
    });
  inFlight.set(key, p);
  await p;
}
