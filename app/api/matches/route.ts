import { NextResponse } from "next/server";
import { createMatchSchema } from "@/types/contracts";
import { createMatch } from "@/services/matches/service";
import { trackEvent } from "@/services/analytics/service";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const input = createMatchSchema.parse(payload);
    const match = await createMatch(input);

    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await trackEvent({
        eventName: "match_created",
        userId: user.id,
        matchId: match.id,
        properties: { skill_level: match.skillLevel },
      });
    }

    // Always redirect to confirm-court step first (organizer must confirm court booking)
    return NextResponse.json(
      { id: match.id, checkoutUrl: `/matches/${match.id}/confirm-court` },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : (error as { message?: string })?.message ?? "Failed to create match";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
