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

export async function blockCourtSlot(params: {
  courtId: string;
  venueId: string;
  date: string;
  time: string;
  note?: string;
}) {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("venue_slot_blocks")
    .insert({
      venue_court_id: params.courtId,
      slot_date: params.date,
      slot_time: params.time,
      note: params.note ?? null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ese horario ya está bloqueado.");
    }
    throw error;
  }
  return data;
}

export async function unblockCourtSlot(blockId: string, venueId: string) {
  const admin = getSupabaseAdminClient();
  const { data: block, error: fetchError } = await admin
    .from("venue_slot_blocks")
    .select("id, venue_court_id")
    .eq("id", blockId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!block) throw new Error("Bloqueo no encontrado.");

  const court = await getCourtOwnedByVenue(block.venue_court_id, venueId);
  if (!court) throw new Error("No autorizado.");

  const { error } = await admin.from("venue_slot_blocks").delete().eq("id", blockId);
  if (error) throw error;
}
