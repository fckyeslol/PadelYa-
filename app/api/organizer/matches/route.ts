import { NextResponse } from "next/server";
import { z } from "zod";
import {
  cancelMatchAsOrganizer,
  confirmCourt,
  markMatchCompleted,
} from "@/services/matches/operations";
import { requireOrganizerUser } from "@/lib/auth/organizer";

const organizerActionSchema = z.object({
  matchId: z.string().uuid(),
  action: z.enum(["confirm", "complete", "cancel"]),
  courtReference: z.string().optional(),
  cancelReason: z.string().optional(),
});

export async function PATCH(request: Request) {
  try {
    await requireOrganizerUser();
    const payload = organizerActionSchema.parse(await request.json());

    if (payload.action === "confirm") {
      await confirmCourt(payload.matchId, payload.courtReference ?? "");
      return NextResponse.json({ message: "Cancha confirmada" });
    }

    if (payload.action === "cancel") {
      await cancelMatchAsOrganizer(
        payload.matchId,
        payload.cancelReason ?? "cancelled_by_organizer",
      );
      return NextResponse.json({ message: "Partido cancelado por organizador" });
    }

    await markMatchCompleted(payload.matchId);
    return NextResponse.json({ message: "Partido marcado como completado" });
  } catch (error) {
    if (error instanceof Error && (error.message === "Not authenticated" || error.message === "Organizer access required")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Unable to apply organizer action";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
