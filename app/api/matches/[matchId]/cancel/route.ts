import { NextResponse } from "next/server";
import { cancelPlayerSpot } from "@/services/matches/operations";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type Params = {
  params: Promise<{ matchId: string }>;
};

export async function POST(_request: Request, { params }: Params) {
  const { matchId } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const result = await cancelPlayerSpot(matchId, user.id);
    return NextResponse.json({
      message: result.isLate
        ? "Cancelación tardía registrada. No aplica reembolso."
        : "Cancelación registrada. Reembolso manual pendiente.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to cancel spot";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
