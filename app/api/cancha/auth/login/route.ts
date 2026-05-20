import { NextResponse } from "next/server";
import { z } from "zod";
import { setVenueSessionCookie } from "@/lib/auth/venue";
import { authenticateVenueAccount } from "@/services/venue-portal/accounts";

const bodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const result = await authenticateVenueAccount(body.username, body.password);

    if (!result) {
      return NextResponse.json({ error: "Usuario o contraseña incorrectos." }, { status: 401 });
    }

    await setVenueSessionCookie({
      accountId: result.account.id,
      venueId: result.account.venue_id,
      username: result.account.username,
      venueName: result.venueName,
    });

    return NextResponse.json({
      ok: true,
      venueId: result.account.venue_id,
      venueName: result.venueName,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al iniciar sesión";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
