import { bogotaDateAndTime, getAvailableTimeSlots, isRuleBasedVenueId } from "@/config/pricing";
import { getVenueInfo } from "@/config/venues";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const ACTIVE_MATCH_STATUSES = ["pending_court", "open", "full", "confirmed"] as const;

export type VenueCourtRow = {
  id: string;
  venue_id: string;
  name: string;
  sort_order: number;
};

/** Horarios del CSV para la sede en una fecha, filtrados si es hoy (Bogotá). */
export function getBookableTimeSlotsForVenue(venueId: string, date: string): string[] {
  const todayStr = new Date().toLocaleString("sv-SE", { timeZone: "America/Bogota" }).slice(0, 10);
  const slots = getAvailableTimeSlots(venueId, date);
  if (date !== todayStr) return slots;

  const nowBogota = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
  return slots.filter((time) => {
    const [h, m] = time.split(":").map(Number);
    const slotAt = new Date(nowBogota);
    slotAt.setHours(h, m, 0, 0);
    return slotAt > nowBogota;
  });
}

export async function listVenueCourts(venueId: string): Promise<VenueCourtRow[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("venue_courts")
    .select("id, venue_id, name, sort_order")
    .eq("venue_id", venueId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as VenueCourtRow[];
}

export async function loadBlocksForCourts(courtIds: string[], date: string) {
  if (!courtIds.length) return new Set<string>();
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("venue_slot_blocks")
    .select("venue_court_id, slot_time")
    .in("venue_court_id", courtIds)
    .eq("slot_date", date);

  if (error) throw error;
  const set = new Set<string>();
  for (const row of data ?? []) {
    set.add(`${row.venue_court_id}:${row.slot_time}`);
  }
  return set;
}

export async function loadMatchesForCourts(courtIds: string[], date: string) {
  if (!courtIds.length) return new Map<string, string>();

  const start = new Date(`${date}T00:00:00-05:00`).toISOString();
  const end = new Date(`${date}T23:59:59.999-05:00`).toISOString();
  const admin = getSupabaseAdminClient();

  const { data, error } = await admin
    .from("matches")
    .select("id, venue_court_id, scheduled_at, status")
    .in("venue_court_id", courtIds)
    .gte("scheduled_at", start)
    .lte("scheduled_at", end)
    .in("status", [...ACTIVE_MATCH_STATUSES]);

  if (error) throw error;

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (!row.venue_court_id) continue;
    const { time } = bogotaDateAndTime(row.scheduled_at);
    map.set(`${row.venue_court_id}:${time}`, row.id);
  }
  return map;
}

export async function isCourtSlotFree(
  courtId: string,
  venueId: string,
  date: string,
  time: string,
): Promise<boolean> {
  const courts = await listVenueCourts(venueId);
  if (!courts.some((c) => c.id === courtId)) return false;

  const [blocks, matches] = await Promise.all([
    loadBlocksForCourts([courtId], date),
    loadMatchesForCourts([courtId], date),
  ]);

  const key = `${courtId}:${time}`;
  if (blocks.has(key)) return false;
  if (matches.has(key)) return false;
  return true;
}

/** Primera cancha libre para sede + fecha + hora. */
export async function pickAvailableCourt(
  venueId: string,
  date: string,
  time: string,
): Promise<string | null> {
  const courts = await listVenueCourts(venueId);
  if (!courts.length) return null;

  const courtIds = courts.map((c) => c.id);
  const [blocks, matches] = await Promise.all([
    loadBlocksForCourts(courtIds, date),
    loadMatchesForCourts(courtIds, date),
  ]);

  for (const court of courts) {
    const key = `${court.id}:${time}`;
    if (!blocks.has(key) && !matches.has(key)) {
      return court.id;
    }
  }
  return null;
}

/** Al menos una cancha física libre en ese horario. */
export async function isVenueSlotBookable(
  venueName: string,
  date: string,
  time: string,
): Promise<boolean> {
  const info = getVenueInfo(venueName);
  if (!info) return true;
  const courtId = await pickAvailableCourt(info.id, date, time);
  return courtId !== null;
}

export function isVenueSlotBookableSync(venueId: string, date: string, time: string): boolean {
  return getBookableTimeSlotsForVenue(venueId, date).includes(time);
}

export async function assertVenueHasCourtForSlot(
  venueName: string,
  scheduledAt: string,
): Promise<string> {
  const info = getVenueInfo(venueName);
  if (!info) {
    throw new Error("Sede no reconocida.");
  }
  const { date, time } = bogotaDateAndTime(scheduledAt);

  // Rule-based venues (Ace, X3) don't use CSV-derived time slots
  if (!isRuleBasedVenueId(info.id)) {
    const slots = getBookableTimeSlotsForVenue(info.id, date);
    if (!slots.includes(time)) {
      throw new Error("Ese horario no está disponible para reservar.");
    }
  }

  const courts = await listVenueCourts(info.id);
  const courtIds = courts.map((c) => c.id);
  const [blocks, matches] = await Promise.all([
    loadBlocksForCourts(courtIds, date),
    loadMatchesForCourts(courtIds, date),
  ]);

  // Primera cancha PadelYa libre (no bloqueada, sin partido) en ese horario.
  //
  // Antes había además un tope contra la disponibilidad scrapeada de EasyCancha, para no
  // crear más partidos que canchas físicamente libres allá. Se eliminó el 2026-07-30 con
  // el scraping: ya era fail-open (sin datos frescos no aplicaba) y la reserva la confirma
  // un humano igual. El control real son los bloqueos que la sede carga en su portal.
  const courtId =
    courts.find((c) => !blocks.has(`${c.id}:${time}`) && !matches.has(`${c.id}:${time}`))?.id ?? null;
  if (!courtId) {
    throw new Error("No hay cancha disponible en ese horario.");
  }

  return courtId;
}

export async function getCourtOwnedByVenue(
  courtId: string,
  venueId: string,
): Promise<VenueCourtRow | null> {
  const courts = await listVenueCourts(venueId);
  return courts.find((c) => c.id === courtId) ?? null;
}
