/**
 * Cliente HTTP de EasyCancha para leer disponibilidad.
 *
 * EasyCancha no tiene anti-bot, pero el API de turnos exige el set completo de
 * headers de navegador (Authorization + Cookie con authtoken/AWSALB + Origin/Referer);
 * con headers parciales devuelve 403. Los tokens se refrescan aparte
 * (scripts/easycancha-refresh-token.ts) y se guardan en la tabla easycancha_accounts:
 * 6 cuentas que rotan para que la extracción quede espaciada y no parezca un bot.
 */
// fetch + ProxyAgent del MISMO undici: pasar un ProxyAgent del paquete instalado al
// fetch global (undici interno de Node) puede no reconocerse entre versiones.
import { fetch as undiciFetch, ProxyAgent } from "undici";
import { EASYCANCHA_BASE_URL, type EasycanchaClub } from "@/config/easycancha";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type EasycanchaSession = {
  token: string;
  awsalb: string;
  expiresAt: string | null;
  /** Proxy residencial sticky de esta cuenta (vacío = directo). */
  proxyUrl?: string;
};

// Cache de ProxyAgent por URL: reusar la conexión en vez de crear uno por request.
const proxyAgents = new Map<string, ProxyAgent>();
function proxyDispatcher(proxyUrl: string | undefined): ProxyAgent | undefined {
  if (!proxyUrl) return undefined;
  let agent = proxyAgents.get(proxyUrl);
  if (!agent) {
    agent = new ProxyAgent(proxyUrl);
    proxyAgents.set(proxyUrl, agent);
  }
  return agent;
}

/** Una cuenta del pool, con su estado de scheduling. */
export type EasycanchaAccount = EasycanchaSession & {
  id: number;
  lastClubId: number | null;
};

type AccountRow = {
  id: number;
  token: string | null;
  awsalb: string | null;
  expires_at: string | null;
  next_run_at: string | null;
  last_club_id: number | null;
  proxy_url: string | null;
  active: boolean;
};

/** Token usable = no vacío y no expirado. */
function sessionIsUsable(token: string | null, expiresAt: string | null): boolean {
  if (!token) return false;
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) return false;
  return true;
}

/** Cuentas con turno vencido (next_run_at <= ahora), activas y con token vigente. */
export async function getDueAccounts(): Promise<EasycanchaAccount[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("easycancha_accounts")
    .select("id, token, awsalb, expires_at, next_run_at, last_club_id, proxy_url, active")
    .eq("active", true);
  if (error) throw new Error(`No pude leer easycancha_accounts: ${error.message}`);

  const now = Date.now();
  return (data as AccountRow[] | null ?? [])
    .filter((r) => sessionIsUsable(r.token, r.expires_at))
    .filter((r) => !r.next_run_at || new Date(r.next_run_at).getTime() <= now)
    .map((r) => ({
      id: r.id,
      token: r.token as string,
      awsalb: r.awsalb ?? "",
      expiresAt: r.expires_at,
      proxyUrl: r.proxy_url ?? "",
      lastClubId: r.last_club_id,
    }));
}

/** Una cuenta cualquiera con token vigente (para fetches on-demand). null si no hay. */
export async function getAnyValidSession(): Promise<EasycanchaSession | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("easycancha_accounts")
    .select("token, awsalb, expires_at, proxy_url")
    .eq("active", true);
  if (error) return null;

  const usable = (data ?? []).filter((r) => sessionIsUsable(r.token, r.expires_at));
  if (!usable.length) return null;
  const pick = usable[Math.floor(Math.random() * usable.length)];
  return {
    token: pick.token as string,
    awsalb: pick.awsalb ?? "",
    expiresAt: pick.expires_at,
    proxyUrl: pick.proxy_url ?? "",
  };
}

/**
 * Marca que una cuenta corrió y reprograma su próximo turno. Devuelve `true` si el
 * update entró. El caller DEBE llamar esto ANTES del fetch (claim): si reprogramar
 * falla, no se debe usar la cuenta este tick, porque su next_run_at quedaría vencido y
 * el heartbeat la volvería a elegir cada 5 min (martilleo contra EasyCancha).
 */
export async function markAccountRan(
  accountId: number,
  clubId: number,
  nextRunAt: Date,
): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("easycancha_accounts")
    .update({
      last_run_at: new Date().toISOString(),
      last_club_id: clubId,
      next_run_at: nextRunAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId);
  return !error;
}

/**
 * Invalida el token de una cuenta (expires_at = ahora) cuando EasyCancha lo rechaza
 * (HTTP 401/403). Así queda "no usable" y el chequeo de salud la reporta como caída.
 */
export async function invalidateAccountToken(accountId: number): Promise<void> {
  const supabase = getSupabaseAdminClient();
  await supabase
    .from("easycancha_accounts")
    .update({
      expires_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId);
}

/** Estado de salud de una cuenta activa, para detectar y avisar caídas. */
export type AccountHealth = {
  id: number;
  label: string;
  usable: boolean;
  expiresAt: string | null;
  downAlertedAt: string | null;
};

/** Salud de todas las cuentas activas: usable = token presente y no vencido. */
export async function getAccountsHealth(): Promise<AccountHealth[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("easycancha_accounts")
    .select("id, label, token, expires_at, down_alerted_at")
    .eq("active", true);
  if (error) throw new Error(`No pude leer salud de easycancha_accounts: ${error.message}`);

  return (data ?? []).map((r) => ({
    id: r.id as number,
    label: (r.label as string) || `cuenta ${r.id}`,
    usable: sessionIsUsable(r.token as string | null, r.expires_at as string | null),
    expiresAt: r.expires_at as string | null,
    downAlertedAt: r.down_alerted_at as string | null,
  }));
}

/** Sella `down_alerted_at = ahora` (ya se avisó que estas cuentas están caídas). */
export async function markAccountsDownAlerted(ids: number[]): Promise<void> {
  if (!ids.length) return;
  const supabase = getSupabaseAdminClient();
  await supabase
    .from("easycancha_accounts")
    .update({ down_alerted_at: new Date().toISOString() })
    .in("id", ids);
}

/** Limpia `down_alerted_at` (las cuentas se recuperaron; alerta resuelta). */
export async function clearAccountsDownAlerted(ids: number[]): Promise<void> {
  if (!ids.length) return;
  const supabase = getSupabaseAdminClient();
  await supabase
    .from("easycancha_accounts")
    .update({ down_alerted_at: null })
    .in("id", ids);
}

export type ParsedSlot = {
  clubId: number;
  courtId: number;
  courtName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM:SS
  endTime: string | null;
  priceCop: number | null;
  isFree: boolean;
  availableForWaitlist: boolean;
};

function buildHeaders(session: EasycanchaSession, clubId: number): Record<string, string> {
  const cookie = [
    `authtoken=${session.token}`,
    "country=CO",
    "acceptLanguage=es-CO",
    "appId=easycancha",
    "appOs=web",
    session.awsalb ? `AWSALB=${session.awsalb}` : "",
    session.awsalb ? `AWSALBCORS=${session.awsalb}` : "",
  ]
    .filter(Boolean)
    .join("; ");

  return {
    Authorization: session.token,
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
    "app-id": "easycancha",
    "app-os": "web",
    acceptLanguage: "es-CO",
    country: "CO",
    Origin: EASYCANCHA_BASE_URL,
    Referer: `${EASYCANCHA_BASE_URL}/book/clubs/${clubId}/sports`,
    Cookie: cookie,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
  };
}

type RawSlot = {
  courtId?: number;
  courtName?: string;
  local_date?: string;
  local_start_time?: string;
  local_end_time?: string;
  bookingId?: number | null;
  availableForWaitingList?: boolean;
  priceInfo?: { app_amount?: number; amount?: number } | null;
};

function toParsed(raw: RawSlot, clubId: number): ParsedSlot | null {
  if (raw.courtId == null || !raw.local_start_time || !raw.local_date) return null;
  const price = raw.priceInfo?.app_amount ?? raw.priceInfo?.amount ?? null;
  return {
    clubId,
    courtId: raw.courtId,
    courtName: (raw.courtName ?? "").trim() || `Cancha ${raw.courtId}`,
    date: raw.local_date,
    startTime: raw.local_start_time,
    endTime: raw.local_end_time ?? null,
    priceCop: price,
    isFree: raw.bookingId == null,
    availableForWaitlist: raw.availableForWaitingList === true,
  };
}

// Anclas de hora realistas; cualquiera devuelve el día completo en alternative_timeslots.
const ANCHOR_TIMES = ["07:00", "09:00", "11:00", "15:00", "18:00"];

/**
 * Trae todos los turnos de un club para una fecha. Una sola llamada: el campo
 * `alternative_timeslots` ya contiene el día completo (agrupado por hora).
 */
export async function fetchDaySlots(
  club: EasycanchaClub,
  date: string,
  session: EasycanchaSession,
  timeoutMs = 15_000,
): Promise<ParsedSlot[]> {
  const anchor = ANCHOR_TIMES[Math.floor(Math.random() * ANCHOR_TIMES.length)];
  const url =
    `${EASYCANCHA_BASE_URL}/api/sports/7/clubs/${club.id}/timeslots` +
    `?date=${date}&time=${anchor}&timespan=${club.timespan}`;

  // `dispatcher` rutea por el proxy residencial sticky de la cuenta (vacío = directo).
  const res = await undiciFetch(url, {
    headers: buildHeaders(session, club.id),
    signal: AbortSignal.timeout(timeoutMs),
    dispatcher: proxyDispatcher(session.proxyUrl),
  });
  if (!res.ok) {
    throw new Error(`timeslots ${club.id} ${date}: HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    error?: unknown;
    timeslots?: RawSlot[];
    alternative_timeslots?: { hour?: string; timeslots?: RawSlot[] }[];
  };
  if (data.error) throw new Error(`timeslots ${club.id} ${date}: error ${String(data.error)}`);

  const raws: RawSlot[] = [
    ...(data.timeslots ?? []),
    ...(data.alternative_timeslots ?? []).flatMap((g) => g.timeslots ?? []),
  ];

  const byKey = new Map<string, ParsedSlot>();
  for (const raw of raws) {
    const parsed = toParsed(raw, club.id);
    if (!parsed) continue;
    byKey.set(`${parsed.courtId}|${parsed.startTime}`, parsed);
  }
  return [...byKey.values()];
}
