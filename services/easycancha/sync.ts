/**
 * Sync de disponibilidad de EasyCancha hacia Supabase + alertas por email.
 *
 * MODELO MULTICUENTA (espaciado y aleatorio): 6 cuentas rotan. Un "heartbeat" (cron
 * cada pocos min) llama a syncTick(), que procesa solo las cuentas con turno vencido.
 * Cada cuenta entra a UN club por turno (elegido al azar pero sesgado al club con data
 * más vieja), trae la ventana caliente (HOT_WINDOW_DAYS) y reprograma su próximo turno
 * en 30/45/60 min al azar. Así el tráfico hacia EasyCancha no parece un bot metronómico.
 *
 * MODELO DE DATOS: el endpoint devuelve SOLO los turnos libres; los ocupados no aparecen
 * (faltan, sin flag). Por eso "libre/ocupado" se deriva por presencia/ausencia y se
 * reconcilia contra lo ya guardado:
 *   - presente ahora                 -> is_free = true
 *   - guardado libre, ahora ausente  -> is_free = false (se ocupó)
 *   - presente ahora y antes ocupado -> transición ocupado->libre (dispara alerta)
 *   - presente y nunca visto         -> primer avistamiento (sin alerta)
 */
import {
  EASYCANCHA_CLUBS,
  type EasycanchaClub,
  getEasycanchaClub,
  HOT_WINDOW_DAYS,
  MORNING_RESUME_SPREAD_MIN,
  QUIET_HOURS_END,
  QUIET_HOURS_START,
  SYNC_INTERVAL_JITTER_MIN,
  SYNC_INTERVALS_MIN,
} from "@/config/easycancha";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  sendEasycanchaAccountsDownEmail,
  sendSlotsAvailableEmail,
} from "@/services/notifications/email";
import {
  clearAccountsDownAlerted,
  type EasycanchaSession,
  fetchDaySlots,
  getAccountsHealth,
  getDueAccounts,
  invalidateAccountToken,
  markAccountRan,
  markAccountsDownAlerted,
  type ParsedSlot,
} from "./client";

// Sigilo: espaciar requests dentro de un mismo turno (no en ráfaga).
const REQ_JITTER_MIN_MS = 120;
const REQ_JITTER_MAX_MS = 500;
const MS_PER_MIN = 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
function jitter(minMs: number, maxMs: number): Promise<void> {
  return sleep(minMs + Math.random() * (maxMs - minMs));
}

export type SyncSummary = {
  accountsProcessed: number;
  clubsSynced: number;
  slotsFree: number;
  becameBooked: number;
  freedTransitions: number;
  alertsSent: number;
  /** Cuentas activas sin token usable al cierre del tick (token vencido o rechazado). */
  accountsDown: number;
  errors: string[];
};

/** ¿El error es un rechazo de auth de EasyCancha (token inválido)? -> invalidar cuenta. */
function isAuthRejection(errorMsg: string): boolean {
  return /HTTP 40[13]\b/.test(errorMsg);
}

type Watch = {
  club_id: number | null;
  weekday: number | null;
  time_from: string | null;
  time_to: string | null;
  notify_email: string;
};

function slotKey(clubId: number, courtId: number, date: string, startTime: string): string {
  return `${clubId}|${courtId}|${date}|${startTime}`;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function bogotaToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

/** Fechas de la ventana caliente: hoy .. hoy + (HOT_WINDOW_DAYS - 1), en Bogotá. */
export function hotWindowDates(): string[] {
  const start = bogotaToday();
  return Array.from({ length: HOT_WINDOW_DAYS }, (_, i) => addDays(start, i));
}

/** 0=domingo … 6=sábado, igual que extract(dow) en Postgres. */
function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

function watchMatches(w: Watch, slot: ParsedSlot): boolean {
  if (w.club_id != null && w.club_id !== slot.clubId) return false;
  if (w.weekday != null && w.weekday !== weekdayOf(slot.date)) return false;
  if (w.time_from && slot.startTime < w.time_from) return false;
  if (w.time_to && slot.startTime > w.time_to) return false;
  return true;
}

// Colombia es UTC-5 todo el año (sin horario de verano), así que basta un offset fijo.
const BOGOTA_OFFSET_MS = -5 * 60 * MS_PER_MIN;

/** Hora local Bogotá (0-23) de una fecha. */
function bogotaHourOf(d: Date): number {
  return new Date(d.getTime() + BOGOTA_OFFSET_MS).getUTCHours();
}

/** ¿La fecha cae en la ventana de silencio de madrugada (Bogotá)? */
function isQuietHour(d: Date): boolean {
  const h = bogotaHourOf(d);
  return h >= QUIET_HOURS_START && h < QUIET_HOURS_END;
}

/**
 * Si la fecha cae en la ventana de silencio, la empuja al fin de la ventana (QUIET_HOURS_END
 * Bogotá de ese día) + un spread aleatorio, para que las cuentas reanuden escalonadas y no
 * todas juntas a las 6am. Fuera de la ventana la devuelve intacta.
 */
function pushPastQuietWindow(d: Date): Date {
  if (!isQuietHour(d)) return d;
  // Desplazar para que los campos UTC se lean como hora-pared de Bogotá, fijar 06:00, volver.
  const b = new Date(d.getTime() + BOGOTA_OFFSET_MS);
  b.setUTCHours(QUIET_HOURS_END, 0, 0, 0);
  const resumeUtc =
    b.getTime() - BOGOTA_OFFSET_MS + Math.random() * MORNING_RESUME_SPREAD_MIN * MS_PER_MIN;
  return new Date(resumeUtc);
}

/**
 * Próximo turno: intervalo al azar de SYNC_INTERVALS_MIN ± jitter. Si cae en la madrugada
 * (ventana de silencio Bogotá), se reprograma al amanecer, escalonado.
 */
function nextRunAt(): Date {
  const base = SYNC_INTERVALS_MIN[Math.floor(Math.random() * SYNC_INTERVALS_MIN.length)];
  const jitterMin = (Math.random() * 2 - 1) * SYNC_INTERVAL_JITTER_MIN;
  const candidate = new Date(Date.now() + (base + jitterMin) * MS_PER_MIN);
  return pushPastQuietWindow(candidate);
}

/**
 * Elige un club al azar pero sesgado al de data más vieja (peso ∝ antigüedad).
 * Clubs nunca vistos pesan al máximo. Evita repetir el último club de la cuenta si hay
 * alternativas, para repartir mejor la cobertura.
 */
async function pickClubByStaleness(avoidClubId: number | null): Promise<EasycanchaClub> {
  const supabase = getSupabaseAdminClient();
  const today = bogotaToday();
  const { data } = await supabase
    .from("easycancha_slots")
    .select("club_id, captured_at")
    .gte("slot_date", today);

  const freshest = new Map<number, number>();
  for (const r of data ?? []) {
    const t = new Date(r.captured_at as string).getTime();
    const cur = freshest.get(r.club_id as number) ?? 0;
    if (t > cur) freshest.set(r.club_id as number, t);
  }

  const NEVER_SEEN_MS = 7 * 24 * 60 * MS_PER_MIN; // peso máximo
  const now = Date.now();
  let candidates = EASYCANCHA_CLUBS.filter((c) => c.id !== avoidClubId);
  if (candidates.length === 0) candidates = [...EASYCANCHA_CLUBS];

  const weighted = candidates.map((club) => {
    const last = freshest.get(club.id);
    const age = last == null ? NEVER_SEEN_MS : Math.max(1, now - last);
    return { club, weight: age };
  });

  const total = weighted.reduce((s, w) => s + w.weight, 0);
  let roll = Math.random() * total;
  for (const w of weighted) {
    roll -= w.weight;
    if (roll <= 0) return w.club;
  }
  return weighted[weighted.length - 1].club;
}

/** Estado previo (libre/ocupado) de un club para un set de fechas, por key. */
async function loadPrevForClubDates(
  clubId: number,
  dates: string[],
): Promise<Map<string, boolean>> {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("easycancha_slots")
    .select("court_id, slot_date, start_time, is_free")
    .eq("club_id", clubId)
    .in("slot_date", dates);

  const prevFreeByKey = new Map<string, boolean>();
  for (const r of data ?? []) {
    prevFreeByKey.set(
      slotKey(clubId, r.court_id as number, r.slot_date as string, r.start_time as string),
      r.is_free as boolean,
    );
  }
  return prevFreeByKey;
}

export type ClubSyncResult = {
  freed: ParsedSlot[];
  slotsFree: number;
  becameBooked: number;
  errors: string[];
};

/**
 * Sincroniza UN club para un set de fechas con una sesión dada. Reusado por el tick
 * (ventana caliente) y por el top-up on-demand (una sola fecha lejana).
 * Devuelve los turnos liberados (ocupado->libre); el caller decide si dispara alertas.
 */
export async function syncClubForDates(
  club: EasycanchaClub,
  dates: string[],
  session: EasycanchaSession,
  options: { timeoutMs?: number; pace?: boolean } = {},
): Promise<ClubSyncResult> {
  const supabase = getSupabaseAdminClient();
  const result: ClubSyncResult = { freed: [], slotsFree: 0, becameBooked: 0, errors: [] };
  const prevFreeByKey = await loadPrevForClubDates(club.id, dates);

  for (const date of dates) {
    if (options.pace) await jitter(REQ_JITTER_MIN_MS, REQ_JITTER_MAX_MS);

    let slots: ParsedSlot[];
    try {
      slots = await fetchDaySlots(club, date, session, options.timeoutMs);
    } catch (e) {
      result.errors.push(e instanceof Error ? e.message : String(e));
      continue;
    }

    const presentKeys = new Set(
      slots.map((s) => slotKey(s.clubId, s.courtId, s.date, s.startTime)),
    );
    const capturedAt = new Date().toISOString();

    // 1) Presentes = libres. Detectar transición ocupado -> libre.
    for (const s of slots) {
      if (prevFreeByKey.get(slotKey(s.clubId, s.courtId, s.date, s.startTime)) === false) {
        result.freed.push(s);
      }
    }
    if (slots.length) {
      const { error } = await supabase.from("easycancha_slots").upsert(
        slots.map((s) => ({
          club_id: s.clubId,
          court_id: s.courtId,
          slot_date: s.date,
          start_time: s.startTime,
          end_time: s.endTime,
          court_name: s.courtName,
          price_cop: s.priceCop,
          is_free: true,
          available_for_waitlist: s.availableForWaitlist,
          captured_at: capturedAt,
        })),
        { onConflict: "club_id,court_id,slot_date,start_time" },
      );
      if (error) result.errors.push(`upsert ${club.id} ${date}: ${error.message}`);
      else result.slotsFree += slots.length;
    }

    // 2) Guardados como libres en esta fecha pero ahora ausentes = se ocuparon.
    const nowBooked: { courtId: number; startTime: string }[] = [];
    for (const [key, wasFree] of prevFreeByKey) {
      if (!wasFree) continue;
      // key = club|court|date|start ; filtrar a esta fecha y ausencia actual.
      const parts = key.split("|");
      if (parts[2] !== date) continue;
      if (presentKeys.has(key)) continue;
      nowBooked.push({ courtId: Number(parts[1]), startTime: parts[3] });
    }
    if (nowBooked.length) {
      const { error } = await supabase.from("easycancha_slots").upsert(
        nowBooked.map((p) => ({
          club_id: club.id,
          court_id: p.courtId,
          slot_date: date,
          start_time: p.startTime,
          is_free: false,
          captured_at: capturedAt,
        })),
        { onConflict: "club_id,court_id,slot_date,start_time" },
      );
      if (error) result.errors.push(`mark-booked ${club.id} ${date}: ${error.message}`);
      else result.becameBooked += nowBooked.length;
    }
  }

  return result;
}

/** Agrupa turnos liberados por email de watch que matchea y manda los avisos. */
async function dispatchFreedAlerts(freed: ParsedSlot[]): Promise<number> {
  if (!freed.length) return 0;
  const supabase = getSupabaseAdminClient();
  const { data: watches } = await supabase
    .from("easycancha_slot_watches")
    .select("club_id, weekday, time_from, time_to, notify_email")
    .eq("active", true);
  if (!watches?.length) return 0;

  const byEmail = new Map<string, ParsedSlot[]>();
  for (const slot of freed) {
    for (const w of watches as Watch[]) {
      if (!watchMatches(w, slot)) continue;
      const list = byEmail.get(w.notify_email) ?? [];
      list.push(slot);
      byEmail.set(w.notify_email, list);
    }
  }
  let sent = 0;
  for (const [email, slots] of byEmail) {
    await sendSlotsAvailableEmail(email, slots);
    sent += 1;
  }
  return sent;
}

/**
 * Un tick del heartbeat: procesa las cuentas con turno vencido. Cada una entra a un
 * club (sesgado al más viejo), trae la ventana caliente y reprograma su próximo turno.
 */
export async function syncTick(): Promise<SyncSummary> {
  const summary: SyncSummary = {
    accountsProcessed: 0,
    clubsSynced: 0,
    slotsFree: 0,
    becameBooked: 0,
    freedTransitions: 0,
    alertsSent: 0,
    accountsDown: 0,
    errors: [],
  };

  const due = await getDueAccounts();

  // Pausa de madrugada (Bogotá): no scrapeamos. Reprogramamos las cuentas vencidas al fin
  // de la ventana (escalonadas vía nextRunAt) para que reanuden de a poco, no en ráfaga.
  // La salud igual se reporta: querés enterarte de un token caído aunque sea de noche.
  if (isQuietHour(new Date())) {
    for (const account of due) {
      await markAccountRan(account.id, account.lastClubId ?? EASYCANCHA_CLUBS[0].id, nextRunAt());
    }
    await reportAccountHealth(summary);
    return summary;
  }

  const dates = hotWindowDates();
  const allFreed: ParsedSlot[] = [];

  // Secuencial entre cuentas: cada cuenta es un "usuario" distinto y no queremos 6
  // ráfagas simultáneas. El jitter por request vive dentro de syncClubForDates.
  for (const account of due) {
    const club = await pickClubByStaleness(account.lastClubId);

    // Claim ANTES del fetch: reprogramar el próximo turno primero. Si esto falla, no
    // usamos la cuenta este tick — de lo contrario quedaría "due" y el heartbeat la
    // re-elegiría cada 5 min, martillando EasyCancha.
    const claimed = await markAccountRan(account.id, club.id, nextRunAt());
    if (!claimed) {
      summary.errors.push(`No pude reprogramar cuenta ${account.id}; la salto este tick`);
      continue;
    }

    const session: EasycanchaSession = {
      token: account.token,
      awsalb: account.awsalb,
      expiresAt: account.expiresAt,
      // Sin esto, el sync sale por la IP del server y se pierde el proxy residencial
      // sticky de la cuenta (las 6 se correlacionarían por IP).
      proxyUrl: account.proxyUrl,
    };

    const res = await syncClubForDates(club, dates, session, { pace: true });
    summary.accountsProcessed += 1;
    summary.clubsSynced += 1;
    summary.slotsFree += res.slotsFree;
    summary.becameBooked += res.becameBooked;
    summary.errors.push(...res.errors);
    allFreed.push(...res.freed);

    // EasyCancha rechazó el token (401/403) -> invalidarlo para que el chequeo de salud
    // lo reporte como caído y dispare la alerta al equipo.
    if (res.errors.some(isAuthRejection)) {
      await invalidateAccountToken(account.id);
    }
  }

  summary.freedTransitions = allFreed.length;
  summary.alertsSent = await dispatchFreedAlerts(allFreed);
  await reportAccountHealth(summary);
  return summary;
}

/**
 * Chequea la salud de todas las cuentas activas y avisa al equipo cuando alguna queda
 * caída (token vencido o rechazado). Deduplica con down_alerted_at: avisa una vez al
 * caer y limpia la marca cuando la cuenta se recupera. Nunca rompe el tick (fail-soft).
 */
async function reportAccountHealth(summary: SyncSummary): Promise<void> {
  let health: Awaited<ReturnType<typeof getAccountsHealth>>;
  try {
    health = await getAccountsHealth();
  } catch (e) {
    summary.errors.push(e instanceof Error ? e.message : String(e));
    return;
  }

  summary.accountsDown = health.filter((a) => !a.usable).length;

  const newlyDown = health.filter((a) => !a.usable && !a.downAlertedAt);
  const recovered = health.filter((a) => a.usable && a.downAlertedAt);

  if (newlyDown.length) {
    await sendEasycanchaAccountsDownEmail(
      newlyDown.map((a) => ({ id: a.id, label: a.label, expiresAt: a.expiresAt })),
    );
    await markAccountsDownAlerted(newlyDown.map((a) => a.id));
  }
  if (recovered.length) {
    await clearAccountsDownAlerted(recovered.map((a) => a.id));
  }
}

/** Util para logs/diagnóstico: nombre del club por id. */
export function clubLabel(clubId: number): string {
  return getEasycanchaClub(clubId)?.name ?? `club ${clubId}`;
}
