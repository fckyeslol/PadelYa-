/**
 * Cliente HTTP de EasyCancha para leer disponibilidad.
 *
 * EasyCancha no tiene anti-bot, pero el API de turnos exige el set completo de
 * headers de navegador (Authorization + Cookie con authtoken/AWSALB + Origin/Referer);
 * con headers parciales devuelve 403. El token se refresca aparte
 * (scripts/easycancha-refresh-token.ts) y se guarda en la tabla easycancha_session.
 */
import { EASYCANCHA_BASE_URL, type EasycanchaClub } from "@/config/easycancha";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type EasycanchaSession = { token: string; awsalb: string; expiresAt: string | null };

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

/** Lee el token vigente de Supabase. Lanza si falta o expiró. */
export async function getStoredSession(): Promise<EasycanchaSession> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("easycancha_session")
    .select("token, awsalb, expires_at")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw new Error(`No pude leer easycancha_session: ${error.message}`);
  if (!data?.token) {
    throw new Error("No hay token de EasyCancha. Corré: npm run easycancha:token");
  }
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
    throw new Error("El token de EasyCancha expiró. Corré: npm run easycancha:token");
  }
  return { token: data.token, awsalb: data.awsalb ?? "", expiresAt: data.expires_at ?? null };
}

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
): Promise<ParsedSlot[]> {
  const anchor = ANCHOR_TIMES[Math.floor(Math.random() * ANCHOR_TIMES.length)];
  const url =
    `${EASYCANCHA_BASE_URL}/api/sports/7/clubs/${club.id}/timeslots` +
    `?date=${date}&time=${anchor}&timespan=${club.timespan}`;

  const res = await fetch(url, {
    headers: buildHeaders(session, club.id),
    signal: AbortSignal.timeout(15_000),
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
