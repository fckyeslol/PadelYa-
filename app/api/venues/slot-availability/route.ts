import { NextResponse } from "next/server";
import { getVenueInfo } from "@/config/venues";
import { getBookableTimeSlotsForVenue, pickAvailableCourt } from "@/services/venue-portal/availability";
import { hasCsvPricingForVenueName } from "@/config/pricing";

/** Horarios reservables: CSV + al menos una cancha física libre. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const venueName = searchParams.get("venueName")?.trim();
    const date = searchParams.get("date");

    if (!venueName || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "venueName y date requeridos" }, { status: 400 });
    }

    if (!hasCsvPricingForVenueName(venueName)) {
      return NextResponse.json({ bookableTimes: [] });
    }

    const info = getVenueInfo(venueName);
    if (!info) {
      return NextResponse.json({ bookableTimes: [] });
    }

    const times = getBookableTimeSlotsForVenue(info.id, date);
    const bookableTimes: string[] = [];

    await Promise.all(
      times.map(async (time) => {
        const courtId = await pickAvailableCourt(info.id, date, time);
        if (courtId) bookableTimes.push(time);
      }),
    );

    bookableTimes.sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ bookableTimes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
