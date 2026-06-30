import { NextResponse } from "next/server";
import { getVenueInfo } from "@/config/venues";
import {
  getBookableTimeSlotsForVenue,
  listVenueCourts,
  loadBlocksForCourts,
  loadMatchesForCourts,
} from "@/services/venue-portal/availability";
import { getEasycanchaDayAvailability } from "@/services/easycancha/availability";
import { fetchRealtimeAvailability } from "@/services/easycancha/realtime";
import { ensureFreshAvailability } from "@/services/easycancha/on-demand";
import { getLivePlayerFeesByTime } from "@/services/easycancha/pricing";
import { hotWindowDates } from "@/services/easycancha/sync";
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

    // Tarifas EN VIVO por horario (vacío si la duración no es el timespan nativo o el sync
    // está caído). Cuando hay dato en vivo, ÉL define los horarios candidatos; si no, caen
    // a las reglas (rule-based) o a horarios fijos (Casa Padel).
    const liveFees = await getLivePlayerFeesByTime(venueName, date, durationMinutes);
    const times =
      liveFees.size > 0
        ? [...liveFees.keys()]
        : isRuleBased
          ? getAvailableTimeSlotsWithDuration(venueName, date, durationMinutes)
          : getBookableTimeSlotsForVenue(info.id, date);

    const [blocks, matches] = await Promise.all([
      loadBlocksForCourts(courtIds, date),
      loadMatchesForCourts(courtIds, date),
    ]);

    // EasyCancha availability: try sync data first, then realtime fallback.
    let ecAvail = await getEasycanchaDayAvailability(venueName, date);
    if (!ecAvail.hasData && !hotWindowDates().includes(date)) {
      await ensureFreshAvailability(venueName, date);
      ecAvail = await getEasycanchaDayAvailability(venueName, date);
    }

    // If sync has no data, try realtime fetch directly from EasyCancha API.
    let realtimeFree: Map<string, number> | null = null;
    if (!ecAvail.hasData) {
      realtimeFree = await fetchRealtimeAvailability(info.id, date, durationMinutes);
    }

    const hasEcData = ecAvail.hasData || realtimeFree !== null;

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

      if (hasEcData) {
        const ecFree = ecAvail.hasData
          ? (ecAvail.freeByTime.get(time) ?? 0)
          : (realtimeFree!.get(time) ?? 0);
        const ecCap = Math.max(0, ecFree - matchesAtTime);
        free = Math.min(free, ecCap);
      }

      freeCourtsByTime[time] = free;
      if (free > 0) bookableTimes.push(time);
    }

    bookableTimes.sort((a, b) => a.localeCompare(b));

    // Tarifa por horario: precio EN VIVO de easycancha_slots; cae a reglas si no hay
    // captura fresca para esa duración/fecha. Misma lógica que el cobro al crear partido.
    const feeByTime: Record<string, number> = {};
    for (const time of bookableTimes) {
      const fee =
        liveFees.get(time) ??
        getPlayerFeeByVenueNameWithDuration(venueName, date, time, durationMinutes);
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
