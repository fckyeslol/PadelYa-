/**
 * Sync de disponibilidad de EasyCancha hacia Supabase + alertas por email.
 *
 * IMPORTANTE sobre el modelo de datos: el endpoint de EasyCancha devuelve SOLO los
 * turnos libres; los ocupados no aparecen (no vienen con un flag, simplemente faltan).
 * Por eso "libre/ocupado" se deriva por presencia/ausencia y se reconcilia contra lo
 * ya guardado:
 *   - presente ahora            -> is_free = true
 *   - guardado libre, ahora ausente -> is_free = false (se ocupó)
 *   - presente ahora y antes ocupado -> transición ocupado->libre (dispara alerta)
 *   - presente y nunca visto    -> primer avistamiento (sin alerta)
 */
import { EASYCANCHA_CLUBS } from "@/config/easycancha";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendSlotsAvailableEmail } from "@/services/notifications/email";
import { fetchDaySlots, getStoredSession, type ParsedSlot } from "./client";

const DEFAULT_DAYS = 14;
// Sigilo: tráfico que no parezca un bot metronómico (EasyCancha no debe notar la extracción).
const CONCURRENCY = 3;
const STARTUP_JITTER_MS = 20_000; // arrancar desfasado del tick exacto del cron
const REQ_JITTER_MIN_MS = 120;
const REQ_JITTER_MAX_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
function jitter(minMs: number, maxMs: number): Promise<void> {
  return sleep(minMs + Math.random() * (maxMs - minMs));
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type SyncSummary = {
  daysSynced: number;
  slotsFree: number;
  becameBooked: number;
  freedTransitions: number;
  alertsSent: number;
  errors: string[];
};

type Watch = {
  club_id: number | null;
  weekday: number | null;
  time_from: string | null;
  time_to: string | null;
  notify_email: string;
};

type PrevSlot = { courtId: number; startTime: string; isFree: boolean };

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

async function runPool<T>(items: T[], worker: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    await Promise.all(items.slice(i, i + CONCURRENCY).map(worker));
  }
}

export async function syncAvailability(options: { days?: number } = {}): Promise<SyncSummary> {
  const days = options.days ?? DEFAULT_DAYS;
  const supabase = getSupabaseAdminClient();
  const session = await getStoredSession();

  const start = bogotaToday();
  const dates = Array.from({ length: days }, (_, i) => addDays(start, i));
  const end = dates[dates.length - 1];

  // Estado previo (por club+fecha) para reconciliar presencia/ausencia.
  const { data: prevRows } = await supabase
    .from("easycancha_slots")
    .select("club_id, court_id, slot_date, start_time, is_free")
    .gte("slot_date", start)
    .lte("slot_date", end);

  const prevByClubDate = new Map<string, PrevSlot[]>();
  for (const r of prevRows ?? []) {
    const k = `${r.club_id}|${r.slot_date}`;
    const list = prevByClubDate.get(k) ?? [];
    list.push({ courtId: r.court_id, startTime: r.start_time, isFree: r.is_free });
    prevByClubDate.set(k, list);
  }

  const summary: SyncSummary = {
    daysSynced: days,
    slotsFree: 0,
    becameBooked: 0,
    freedTransitions: 0,
    alertsSent: 0,
    errors: [],
  };
  const freed: ParsedSlot[] = [];

  const jobs = shuffle(EASYCANCHA_CLUBS.flatMap((club) => dates.map((date) => ({ club, date }))));

  await sleep(Math.random() * STARTUP_JITTER_MS); // de-sync del tick exacto del cron

  await runPool(jobs, async ({ club, date }) => {
    await jitter(REQ_JITTER_MIN_MS, REQ_JITTER_MAX_MS); // espaciar requests, no en ráfaga
    let slots: ParsedSlot[];
    try {
      slots = await fetchDaySlots(club, date, session);
    } catch (e) {
      summary.errors.push(e instanceof Error ? e.message : String(e));
      return;
    }

    const prev = prevByClubDate.get(`${club.id}|${date}`) ?? [];
    const prevFreeByKey = new Map<string, boolean>();
    for (const p of prev) {
      prevFreeByKey.set(slotKey(club.id, p.courtId, date, p.startTime), p.isFree);
    }
    const presentKeys = new Set(slots.map((s) => slotKey(s.clubId, s.courtId, s.date, s.startTime)));
    const capturedAt = new Date().toISOString();

    // 1) Presentes = libres. Detectar transición ocupado -> libre.
    for (const s of slots) {
      if (prevFreeByKey.get(slotKey(s.clubId, s.courtId, s.date, s.startTime)) === false) {
        freed.push(s);
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
      if (error) summary.errors.push(`upsert ${club.id} ${date}: ${error.message}`);
      else summary.slotsFree += slots.length;
    }

    // 2) Guardados como libres pero ahora ausentes = se ocuparon.
    const nowBooked = prev.filter(
      (p) => p.isFree && !presentKeys.has(slotKey(club.id, p.courtId, date, p.startTime)),
    );
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
      if (error) summary.errors.push(`mark-booked ${club.id} ${date}: ${error.message}`);
      else summary.becameBooked += nowBooked.length;
    }
  });

  summary.freedTransitions = freed.length;

  // 3) Alertas: agrupar turnos liberados por email de watch que matchea.
  if (freed.length) {
    const { data: watches } = await supabase
      .from("easycancha_slot_watches")
      .select("club_id, weekday, time_from, time_to, notify_email")
      .eq("active", true);

    if (watches?.length) {
      const byEmail = new Map<string, ParsedSlot[]>();
      for (const slot of freed) {
        for (const w of watches as Watch[]) {
          if (!watchMatches(w, slot)) continue;
          const list = byEmail.get(w.notify_email) ?? [];
          list.push(slot);
          byEmail.set(w.notify_email, list);
        }
      }
      for (const [email, slots] of byEmail) {
        await sendSlotsAvailableEmail(email, slots);
        summary.alertsSent += 1;
      }
    }
  }

  return summary;
}
