import { NextResponse } from "next/server";
import { z } from "zod";
import { setVenueSessionCookie } from "@/lib/auth/venue";
import { authenticateVenueAccount } from "@/services/venue-portal/accounts";
import { checkLoginRateLimit, recordLoginAttempt } from "@/services/venue-portal/security";

const bodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());

    // Freno de fuerza bruta ANTES de verificar la contraseña: el portal lo usan clubes
    // desde internet abierta, el login no puede ser ilimitado.
    const verdict = await checkLoginRateLimit(body.username);
    if (!verdict.allowed) {
      return NextResponse.json(
        { error: `Demasiados intentos fallidos. Probá de nuevo en ${verdict.retryAfterMinutes} min.` },
        { status: 429 },
      );
    }

    const result = await authenticateVenueAccount(body.username, body.password);

    if (!result) {
      await recordLoginAttempt(body.username, false);
      return NextResponse.json({ error: "Usuario o contraseña incorrectos." }, { status: 401 });
    }

    await recordLoginAttempt(body.username, true);

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
