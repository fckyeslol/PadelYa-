import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVenueSession } from "@/lib/auth/venue";
import { venueRouteError } from "@/lib/auth/venue-route";
import { DAY_TYPES } from "@/config/venue-pricing-rules";
import { listVenueHours, upsertVenueHours } from "@/services/venue-portal/pricing";

const HHMM = /^\d{2}:\d{2}$/;

const putSchema = z.object({
  dayType: z.enum(DAY_TYPES as unknown as [string, ...string[]]),
  opensAt: z.string().regex(HHMM, "usá formato HH:MM").nullable(),
  closesAt: z.string().regex(HHMM, "usá formato HH:MM").nullable(),
  isClosed: z.boolean(),
});

export async function GET() {
  try {
    const session = await requireVenueSession();
    return NextResponse.json({ hours: await listVenueHours(session.venueId) });
  } catch (error) {
    return venueRouteError(error, "No se pudo cargar el horario.");
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireVenueSession();
    const body = putSchema.parse(await request.json());

    await upsertVenueHours({
      venueId: session.venueId,
      dayType: body.dayType as (typeof DAY_TYPES)[number],
      opensAt: body.opensAt,
      closesAt: body.closesAt,
      isClosed: body.isClosed,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return venueRouteError(error, "No se pudo guardar el horario.");
  }
}
