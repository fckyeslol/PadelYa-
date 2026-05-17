import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  set1Team1: z.number().int().min(0).max(7),
  set1Team2: z.number().int().min(0).max(7),
  set2Team1: z.number().int().min(0).max(7),
  set2Team2: z.number().int().min(0).max(7),
  set3Team1: z.number().int().min(0).max(7).optional(),
  set3Team2: z.number().int().min(0).max(7).optional(),
  winnerTeam: z.union([z.literal(1), z.literal(2)]),
});

type Props = { params: Promise<{ matchId: string }> };

export async function POST(request: Request, { params }: Props) {
  try {
    const { matchId } = await params;
    const body = await request.json();
    const data = schema.parse(body);

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Verify user is a participant or host
    const { data: match } = await supabase
      .from("matches")
      .select("id, host_player_id, status")
      .eq("id", matchId)
      .maybeSingle();

    if (!match) {
      return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
    }

    if (match.status !== "completed" && match.status !== "confirmed") {
      return NextResponse.json(
        { error: "Solo se puede registrar el resultado de partidos completados" },
        { status: 409 },
      );
    }

    const admin = getSupabaseAdminClient();

    const { error } = await admin.from("match_results").upsert(
      {
        match_id: matchId,
        set1_team1: data.set1Team1,
        set1_team2: data.set1Team2,
        set2_team1: data.set2Team1,
        set2_team2: data.set2Team2,
        set3_team1: data.set3Team1 ?? null,
        set3_team2: data.set3Team2 ?? null,
        winner_team: data.winnerTeam,
        recorded_by: user.id,
      },
      { onConflict: "match_id" },
    );

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : (error as { message?: string })?.message ?? "Error al guardar el resultado";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(_request: Request, { params }: Props) {
  try {
    const { matchId } = await params;
    const supabase = await getSupabaseServerClient();

    const { data, error } = await supabase
      .from("match_results")
      .select("*")
      .eq("match_id", matchId)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ result: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
