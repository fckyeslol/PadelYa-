import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVenueSession } from "@/lib/auth/venue";
import { venueRouteError } from "@/lib/auth/venue-route";
import { COURT_MARKUP_COP, DAY_TYPES } from "@/config/venue-pricing-rules";
import { listVenuePriceRules, replaceVenuePriceRules } from "@/services/venue-portal/pricing";

const HHMM = /^\d{2}:\d{2}$/;

const putSchema = z.object({
  dayType: z.enum(DAY_TYPES as unknown as [string, ...string[]]),
  durationMinutes: z.union([z.literal(60), z.literal(90), z.literal(120)]),
  rules: z
    .array(
      z.object({
        startTime: z.string().regex(HHMM, "usá formato HH:MM"),
        endTime: z.string().regex(HHMM, "usá formato HH:MM"),
        courtPriceCop: z.number().int().positive(),
      }),
    )
    .max(48, "Demasiadas franjas para un mismo día."),
});

/** Tarifario completo de la sede + la comisión, para que el portal muestre ambos números. */
export async function GET() {
  try {
    const session = await requireVenueSession();
    const rules = await listVenuePriceRules(session.venueId);
    return NextResponse.json({ rules, courtMarkupCop: COURT_MARKUP_COP });
  } catch (error) {
    return venueRouteError(error, "No se pudo cargar el tarifario.");
  }
}

/** Reemplaza la grilla de un día + duración. El portal siempre manda la lista completa. */
export async function PUT(request: Request) {
  try {
    const session = await requireVenueSession();
    const body = putSchema.parse(await request.json());

    const saved = await replaceVenuePriceRules({
      venueId: session.venueId,
      dayType: body.dayType as (typeof DAY_TYPES)[number],
      durationMinutes: body.durationMinutes,
      rules: body.rules,
    });

    return NextResponse.json({ ok: true, saved });
  } catch (error) {
    return venueRouteError(error, "No se pudo guardar el tarifario.");
  }
}
