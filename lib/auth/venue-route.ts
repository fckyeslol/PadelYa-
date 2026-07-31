import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * Respuesta de error uniforme para las rutas del portal de sedes.
 *
 * Traduce los tres casos que se repiten en todas: sesión ausente (401), body inválido
 * (400 con el detalle de Zod aplanado) y error de negocio (400 con el mensaje, que ya
 * viene escrito para que lo lea una persona del club).
 */
export function venueRouteError(error: unknown, fallback: string): NextResponse {
  if (error instanceof Error && error.message === "Venue session required") {
    return NextResponse.json({ error: "Tu sesión venció. Volvé a entrar." }, { status: 401 });
  }

  if (error instanceof ZodError) {
    const first = error.issues[0];
    return NextResponse.json(
      { error: first ? `${first.path.join(".")}: ${first.message}` : "Datos inválidos." },
      { status: 400 },
    );
  }

  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status: 400 });
}
