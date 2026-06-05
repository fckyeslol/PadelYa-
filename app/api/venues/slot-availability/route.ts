import { NextResponse } from "next/server";
import { getVenueInfo } from "@/config/venues";
import {
  getBookableTimeSlotsForVenue,
  listVenueCourts,
  loadBlocksForCourts,
  loadMatchesForCourts,
} from "@/services/venue-portal/availability";
import { getEasycanchaDayAvailability } from "@/services/easycancha/availability";
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

    // Load blocks + existing matches + EasyCancha availability once.
    const [blocks, matches, ecAvail] = await Promise.all([
      loadBlocksForCourts(courtIds, date),
      loadMatchesForCourts(courtIds, date),
      getEasycanchaDayAvailability(venueName, date),
    ]);

    const freeCourtsByTime: Record<string, number> = {};
    const bookableTimes: string[] = [];

    for (const time of times) {
      let free = 0;
      let matchesAtTime = 0;
      for (const court of courts) {
        const key = `${court.id}:${time}`;
        const hasMatch = matches.has(key);
        if (hasMatch) matchesAtTime++;
        if (!blocks.has(key) && !hasMatch) free++;
      }
      // Tope EasyCancha (si hay datos): no ofrecer más cupos que canchas libres reales.
      if (ecAvail.hasData) {
        const ecCap = Math.max(0, (ecAvail.freeByTime.get(time) ?? 0) - matchesAtTime);
        free = Math.min(free, ecCap);
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
