import { BARRANQUILLA_VENUES } from "@/config/venues";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getBookableTimeSlotsForVenue,
  getCourtOwnedByVenue,
  listVenueCourts,
  loadBlocksForCourts,
  loadMatchesForCourts,
} from "@/services/venue-portal/availability";

export type SlotStatus = "available" | "blocked" | "booked";

export type ScheduleSlotCell = {
  time: string;
  status: SlotStatus;
  matchId?: string;
  blockId?: string;
};

export type ScheduleCourtRow = {
  courtId: string;
  courtName: string;
  slots: ScheduleSlotCell[];
};

export type VenueDaySchedule = {
  venueId: string;
  venueName: string;
  date: string;
  times: string[];
  courts: ScheduleCourtRow[];
};

export async function getVenueDaySchedule(
  venueId: string,
  date: string,
): Promise<VenueDaySchedule> {
  const venueMeta = BARRANQUILLA_VENUES.find((v) => v.id === venueId);
  const courts = await listVenueCourts(venueId);
  const times = getBookableTimeSlotsForVenue(venueId, date);
  const courtIds = courts.map((c) => c.id);

  const [blocks, matches] = await Promise.all([
    loadBlocksForCourts(courtIds, date),
    loadMatchesForCourts(courtIds, date),
  ]);

  const blockIds = await loadBlockIds(courtIds, date);

  const rows: ScheduleCourtRow[] = courts.map((court) => ({
    courtId: court.id,
    courtName: court.name,
    slots: times.map((time) => {
      const key = `${court.id}:${time}`;
      if (blocks.has(key)) {
        return {
          time,
          status: "blocked" as const,
          blockId: blockIds.get(key),
        };
      }
      const matchId = matches.get(key);
      if (matchId) {
        return { time, status: "booked" as const, matchId };
      }
      return { time, status: "available" as const };
    }),
  }));

  return {
    venueId,
    venueName: venueMeta?.name ?? venueId,
    date,
    times,
    courts: rows,
  };
}

async function loadBlockIds(courtIds: string[], date: string) {
  if (!courtIds.length) return new Map<string, string>();
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("venue_slot_blocks")
    .select("id, venue_court_id, slot_time")
    .in("venue_court_id", courtIds)
    .eq("slot_date", date);

  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(`${row.venue_court_id}:${row.slot_time}`, row.id);
  }
  return map;
}

/** Bloquea el horario en TODAS las canchas del venue para que ningún jugador pueda reservar. */
export async function blockVenueSlot(params: {
  venueId: string;
  date: string;
  time: string;
  note?: string;
}) {
  const courts = await listVenueCourts(params.venueId);
  if (!courts.length) throw new Error("No hay canchas registradas para esta sede.");

  const admin = getSupabaseAdminClient();
  const rows = courts.map((c) => ({
    venue_court_id: c.id,
    slot_date: params.date,
    slot_time: params.time,
    note: params.note ?? null,
  }));

  const { error } = await admin
    .from("venue_slot_blocks")
    .upsert(rows, { onConflict: "venue_court_id,slot_date,slot_time", ignoreDuplicates: true });

  if (error) throw error;
}

/** Desbloquea el horario en TODAS las canchas del venue a esa hora. */
export async function unblockVenueSlot(params: {
  venueId: string;
  date: string;
  time: string;
}) {
  const courts = await listVenueCourts(params.venueId);
  if (!courts.length) return;

  const admin = getSupabaseAdminClient();
  const courtIds = courts.map((c) => c.id);

  const { error } = await admin
    .from("venue_slot_blocks")
    .delete()
    .in("venue_court_id", courtIds)
    .eq("slot_date", params.date)
    .eq("slot_time", params.time);

  if (error) throw error;
}
