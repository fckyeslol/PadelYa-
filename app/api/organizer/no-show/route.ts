import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireOrganizerUser } from "@/lib/auth/organizer";

const noShowSchema = z.object({
  matchPlayerId: z.string().uuid(),
});

export async function PATCH(request: Request) {
  try {
    await requireOrganizerUser();
    const payload = noShowSchema.parse(await request.json());
    const supabase = getSupabaseAdminClient();

    const { error } = await supabase
      .from("match_players")
      .update({
        status: "no_show",
      })
      .eq("id", payload.matchPlayerId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ message: "No-show registrado" });
  } catch (error) {
    if (error instanceof Error && (error.message === "Not authenticated" || error.message === "Organizer access required")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Failed to mark no-show";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
