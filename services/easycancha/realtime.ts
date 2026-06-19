/**
 * Fetch de disponibilidad en tiempo real desde EasyCancha.
 *
 * Alternativa al sync con cron: llama directo a la API de EasyCancha usando
 * un token almacenado en EASYCANCHA_REALTIME_TOKEN. Se usa cuando el sync
 * (tabla easycancha_slots) no tiene data fresca.
 *
 * El token es un JWT de usuario con ~7 días de vida. Para renovarlo:
 * 1. Abre easycancha.com en el browser y logueate
 * 2. En DevTools → Application → Cookies → copia "authtoken"
 * 3. Actualiza EASYCANCHA_REALTIME_TOKEN en Vercel
 */

import { EASYCANCHA_CLUBS, type EasycanchaClub } from "@/config/easycancha";

const ANCHOR_TIMES = ["07:00", "09:00", "11:00", "15:00", "18:00"];

type RawSlot = {
  courtId?: number;
  courtName?: string;
  local_date?: string;
  local_start_time?: string;
  local_end_time?: string;
  bookingId?: number | null;
  priceInfo?: { app_amount?: number; amount?: number } | null;
};

export type RealtimeSlot = {
  startTime: string;
  courtCount: number;
};

function getRealtimeEnv(): { token: string; awsalb: string } | null {
  const token = process.env.EASYCANCHA_REALTIME_TOKEN;
  if (!token) return null;
  return { token, awsalb: process.env.EASYCANCHA_REALTIME_AWSALB ?? "" };
}

function buildHeaders(token: string, awsalb: string, clubId: number): Record<string, string> {
  const cookie = [
    `authtoken=${token}`,
    "country=CO",
    "acceptLanguage=es-CO",
    "appId=easycancha",
    "appOs=web",
    awsalb ? `AWSALB=${awsalb}` : "",
    awsalb ? `AWSALBCORS=${awsalb}` : "",
  ]
    .filter(Boolean)
    .join("; ");

  return {
    Authorization: token,
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
    "app-id": "easycancha",
    "app-os": "web",
    acceptLanguage: "es-CO",
    country: "CO",
    Origin: "https://www.easycancha.com",
    Referer: `https://www.easycancha.com/book/clubs/${clubId}/sports`,
    Cookie: cookie,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
  };
}

function clubForVenueId(venueId: string): EasycanchaClub | undefined {
  return EASYCANCHA_CLUBS.find((c) => c.venueId === venueId);
}

/**
 * Fetch disponibilidad en tiempo real para un venue + fecha.
 * Devuelve un Map<"HH:MM", canchas_libres> o null si no se puede consultar.
 */
export async function fetchRealtimeAvailability(
  venueId: string,
  date: string,
  durationMinutes: 60 | 90 | 120 = 90,
): Promise<Map<string, number> | null> {
  const env = getRealtimeEnv();
  if (!env) return null;

  const club = clubForVenueId(venueId);
  if (!club) return null;

  const timespan = durationMinutes;
  const anchor = ANCHOR_TIMES[Math.floor(Math.random() * ANCHOR_TIMES.length)];
  const url =
    `https://www.easycancha.com/api/sports/7/clubs/${club.id}/timeslots` +
    `?date=${date}&time=${anchor}&timespan=${timespan}`;

  try {
    const res = await fetch(url, {
      headers: buildHeaders(env.token, env.awsalb, club.id),
      signal: AbortSignal.timeout(6_000),
    });

    if (!res.ok) {
      console.error(`[easycancha-realtime] ${club.id} ${date}: HTTP ${res.status}`);
      return null;
    }

    const data = (await res.json()) as {
      error?: unknown;
      timeslots?: RawSlot[];
      alternative_timeslots?: { hour?: string; timeslots?: RawSlot[] }[];
    };

    if (data.error) {
      console.error(`[easycancha-realtime] ${club.id} ${date}: error`, data.error);
      return null;
    }

    const raws: RawSlot[] = [
      ...(data.timeslots ?? []),
      ...(data.alternative_timeslots ?? []).flatMap((g) => g.timeslots ?? []),
    ];

    const freeByTime = new Map<string, number>();
    for (const raw of raws) {
      if (raw.bookingId != null) continue;
      const hhmm = raw.local_start_time?.slice(0, 5);
      if (!hhmm) continue;
      freeByTime.set(hhmm, (freeByTime.get(hhmm) ?? 0) + 1);
    }

    return freeByTime;
  } catch (err) {
    console.error("[easycancha-realtime] fetch failed:", err);
    return null;
  }
}
