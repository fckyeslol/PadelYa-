import { NextResponse } from "next/server";
import { requireVenueSession } from "@/lib/auth/venue";
import { getVenueDaySchedule } from "@/services/venue-portal/schedule";

export async function GET(request: Request) {
  try {
    const session = await requireVenueSession();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Fecha inválida (YYYY-MM-DD)." }, { status: 400 });
    }

    const schedule = await getVenueDaySchedule(session.venueId, date);
    return NextResponse.json(schedule);
  } catch (error) {
    if (error instanceof Error && error.message === "Venue session required") {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Error al cargar agenda";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
