import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { sanitizeDisplayName } from "@/utils/name";

const schema = z.object({
  content: z.string().trim().min(1).max(500),
});

type Props = { params: Promise<{ matchId: string }> };

async function canSendMessage(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  userId: string,
  matchId: string,
): Promise<boolean> {
  const { data: match } = await supabase
    .from("matches")
    .select("host_player_id")
    .eq("id", matchId)
    .maybeSingle();

  if (!match) return false;
  if (match.host_player_id === userId) return true;

  // Organizers (admins) can use any match chat, even when they are neither the
  // host nor an enrolled player. Mirrors the `canChat` gate in the match page.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.role === "organizer") return true;

  const { data: player } = await supabase
    .from("match_players")
    .select("status")
    .eq("match_id", matchId)
    .eq("player_id", userId)
    .maybeSingle();

  return (
    !!player &&
    (player.status === "paid" || player.status === "pending_payment")
  );
}

export async function POST(request: Request, { params }: Props) {
  try {
    const { matchId } = await params;
    const body = await request.json();
    const { content } = schema.parse(body);

    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const allowed = await canSendMessage(supabase, user.id, matchId);
    if (!allowed) {
      return NextResponse.json(
        { error: "No tienes permiso para escribir en este chat" },
        { status: 403 },
      );
    }

    const admin = getSupabaseAdminClient();
    const { data: row, error } = await admin
      .from("match_messages")
      .insert({
        match_id: matchId,
        player_id: user.id,
        content,
      })
      .select("id, player_id, content, created_at")
      .single();

    if (error) throw error;

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    return NextResponse.json({
      message: {
        id: row.id,
        playerId: row.player_id,
        playerName: sanitizeDisplayName(profile?.full_name ?? "Yo", "Yo"),
        playerAvatar: profile?.avatar_url ?? null,
        content: row.content,
        createdAt: row.created_at,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : ((error as { message?: string })?.message ??
          "Error al enviar el mensaje");
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
