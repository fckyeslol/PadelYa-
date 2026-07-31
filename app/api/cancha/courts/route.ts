import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVenueSession } from "@/lib/auth/venue";
import { venueRouteError } from "@/lib/auth/venue-route";
import { createCourt, listCourtsForAdmin, updateCourt } from "@/services/venue-portal/courts";

const postSchema = z.object({ name: z.string().min(1).max(40) });

const patchSchema = z
  .object({
    courtId: z.string().uuid(),
    name: z.string().min(1).max(40).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((b) => b.name !== undefined || b.isActive !== undefined, {
    message: "No hay nada que cambiar.",
  });

export async function GET() {
  try {
    const session = await requireVenueSession();
    return NextResponse.json({ courts: await listCourtsForAdmin(session.venueId) });
  } catch (error) {
    return venueRouteError(error, "No se pudieron cargar las canchas.");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireVenueSession();
    const body = postSchema.parse(await request.json());
    const court = await createCourt(session.venueId, body.name);
    return NextResponse.json({ ok: true, court });
  } catch (error) {
    return venueRouteError(error, "No se pudo crear la cancha.");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireVenueSession();
    const body = patchSchema.parse(await request.json());

    await updateCourt({
      venueId: session.venueId,
      courtId: body.courtId,
      name: body.name,
      isActive: body.isActive,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return venueRouteError(error, "No se pudo guardar el cambio.");
  }
}
