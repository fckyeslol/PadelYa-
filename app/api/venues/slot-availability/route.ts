import { NextResponse } from "next/server";
import { getVenueInfo } from "@/config/venues";
import {
  getBookableTimeSlotsForVenue,
  listVenueCourts,
  loadBlocksForCourts,
  loadMatchesForCourts,
} from "@/services/venue-portal/availability";
import {
  hasCsvPricingForVenueName,
  isRuleBasedVenueName,
  getAvailableTimeSlotsWithDuration,
  getPlayerFeeByVenueNameWithDuration,
} from "@/config/pricing";

/**
 * Horarios reservables para una sede + fecha.
 * Devuelve, por horario, cuántas canchas físicas están libres — así el
 * formulario puede mostrar la capacidad real (varios partidos por hora).
 *
 * La disponibilidad sale SOLO de datos propios (canchas de PadelYa, bloqueos del
 * portal de sedes y partidos ya creados). El tope contra EasyCancha se elimino junto
 * con el scraping el 2026-07-30: ya era fail-open y la reserva de cancha la confirma
 * un humano igual (match_operations → court_booking_pending).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const venueName = searchParams.get("venueName")?.trim();
    const date = searchParams.get("date");
    const durationParam = searchParams.get("duration");
    const durationMinutes: 60 | 90 | 120 =
      durationParam === "60" ? 60 : durationParam === "120" ? 120 : 90;

    if (!venueName || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "venueName y date requeridos" }, { status: 400 });
    }

    const isRuleBased = isRuleBasedVenueName(venueName);
    const hasCsv = hasCsvPricingForVenueName(venueName);

    if (!hasCsv && !isRuleBased) {
      return NextResponse.json({ bookableTimes: [], freeCourtsByTime: {}, totalCourts: 0 });
    }

    const info = getVenueInfo(venueName);
    if (!info) {
      return NextResponse.json({ bookableTimes: [], freeCourtsByTime: {}, totalCourts: 0 });
    }

    const courts = await listVenueCourts(info.id);
    const courtIds = courts.map((c) => c.id);

    const times = isRuleBased
      ? getAvailableTimeSlotsWithDuration(venueName, date, durationMinutes)
      : getBookableTimeSlotsForVenue(info.id, date);

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

    // Tarifa por horario desde las reglas (misma lógica que el cobro al crear partido).
    const feeByTime: Record<string, number> = {};
    for (const time of bookableTimes) {
      const fee = getPlayerFeeByVenueNameWithDuration(venueName, date, time, durationMinutes);
      if (fee != null) feeByTime[time] = fee;
    }

    return NextResponse.json({
      bookableTimes,
      freeCourtsByTime,
      totalCourts: courts.length,
      feeByTime,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
