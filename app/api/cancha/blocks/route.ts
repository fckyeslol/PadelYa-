import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVenueSession } from "@/lib/auth/venue";
import { blockVenueSlot, unblockVenueSlot } from "@/services/venue-portal/schedule";

const postSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  note: z.string().optional(),
});

const deleteSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
});

export async function POST(request: Request) {
  try {
    const session = await requireVenueSession();
    const body = postSchema.parse(await request.json());

    await blockVenueSlot({
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

    await unblockVenueSlot({
      venueId: session.venueId,
      date: body.date,
      time: body.time,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Venue session required") {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "No se pudo desbloquear";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
