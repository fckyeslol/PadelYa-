import { NextResponse } from "next/server";
import { getVenueInfo } from "@/config/venues";
import {
  getBookableTimeSlotsForVenue,
  listVenueCourts,
  loadBlocksForCourts,
  loadMatchesForCourts,
} from "@/services/venue-portal/availability";
import { hasCsvPricingForVenueName } from "@/config/pricing";

/**
 * Horarios reservables para una sede + fecha.
 * Devuelve, por horario, cuántas canchas físicas están libres — así el
 * formulario puede mostrar la capacidad real (varios partidos por hora).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const venueName = searchParams.get("venueName")?.trim();
    const date = searchParams.get("date");

    if (!venueName || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "venueName y date requeridos" }, { status: 400 });
    }

    if (!hasCsvPricingForVenueName(venueName)) {
      return NextResponse.json({ bookableTimes: [], freeCourtsByTime: {}, totalCourts: 0 });
    }

    const info = getVenueInfo(venueName);
    if (!info) {
      return NextResponse.json({ bookableTimes: [], freeCourtsByTime: {}, totalCourts: 0 });
    }

    const courts = await listVenueCourts(info.id);
    const courtIds = courts.map((c) => c.id);
    const times = getBookableTimeSlotsForVenue(info.id, date);

    // Load blocks + existing matches once, then count free courts per slot.
    const [blocks, matches] = await Promise.all([
      loadBlocksForCourts(courtIds, date),
      loadMatchesForCourts(courtIds, date),
    ]);

    const freeCourtsByTime: Record<string, number> = {};
    const bookableTimes: string[] = [];

    for (const time of times) {
      let free = 0;
      for (const court of courts) {
        const key = `${court.id}:${time}`;
        if (!blocks.has(key) && !matches.has(key)) free++;
      }
      freeCourtsByTime[time] = free;
      if (free > 0) bookableTimes.push(time);
    }

    bookableTimes.sort((a, b) => a.localeCompare(b));

    return NextResponse.json({
      bookableTimes,
      freeCourtsByTime,
      totalCourts: courts.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
