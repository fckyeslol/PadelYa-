import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVenueSession } from "@/lib/auth/venue";
import { getCourtOwnedByVenue } from "@/services/venue-portal/availability";
import { blockCourtSlot, unblockCourtSlot } from "@/services/venue-portal/schedule";

const postSchema = z.object({
  courtId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  note: z.string().optional(),
});

const deleteSchema = z.object({
  blockId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const session = await requireVenueSession();
    const body = postSchema.parse(await request.json());

    const court = await getCourtOwnedByVenue(body.courtId, session.venueId);
    if (!court) {
      return NextResponse.json({ error: "Cancha no encontrada." }, { status: 404 });
    }

    await blockCourtSlot({
      courtId: body.courtId,
      venueId: session.venueId,
      date: body.date,
      time: body.time,
      note: body.note,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Venue session required") {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "No se pudo bloquear";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireVenueSession();
    const body = deleteSchema.parse(await request.json());
    await unblockCourtSlot(body.blockId, session.venueId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Venue session required") {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "No se pudo desbloquear";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
