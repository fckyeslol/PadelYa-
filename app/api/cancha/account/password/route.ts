import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVenueSession } from "@/lib/auth/venue";
import { venueRouteError } from "@/lib/auth/venue-route";
import { changeVenuePassword, hasSeededPassword } from "@/services/venue-portal/security";

const postSchema = z.object({
  currentPassword: z.string().min(1, "Escribí tu contraseña actual."),
  newPassword: z.string().min(1, "Escribí la contraseña nueva."),
});

/** Estado de la cuenta: sirve para avisar que sigue con la contraseña que le dimos. */
export async function GET() {
  try {
    const session = await requireVenueSession();
    return NextResponse.json({
      username: session.username,
      venueName: session.venueName,
      usingSeededPassword: await hasSeededPassword(session.accountId),
    });
  } catch (error) {
    return venueRouteError(error, "No se pudo cargar tu cuenta.");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireVenueSession();
    const body = postSchema.parse(await request.json());

    const result = await changeVenuePassword({
      accountId: session.accountId,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return venueRouteError(error, "No se pudo cambiar la contraseña.");
  }
}
