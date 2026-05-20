import { NextResponse } from "next/server";
import { requireVenueSession } from "@/lib/auth/venue";
import { getCourtOwnedByVenue } from "@/services/venue-portal/availability";
import { getSlotBookingDetail } from "@/services/venue-portal/slot-detail";

type Params = { params: Promise<{ courtId: string; date: string; time: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await requireVenueSession();
    const { courtId, date, time } = await params;
    const decodedTime = decodeURIComponent(time);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(decodedTime)) {
      return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
    }

    const court = await getCourtOwnedByVenue(courtId, session.venueId);
    if (!court) {
      return NextResponse.json({ error: "Cancha no encontrada." }, { status: 404 });
    }

    const detail = await getSlotBookingDetail(courtId, session.venueId, date, decodedTime);
    if (!detail) {
      return NextResponse.json({ error: "Sin reserva en este horario." }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    if (error instanceof Error && error.message === "Venue session required") {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Error al cargar detalle";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
