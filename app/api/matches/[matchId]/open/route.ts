import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createCheckoutForMatch } from "@/services/payments/service";
import { notifyOwnerNewGame, notifyHostMatchCreated } from "@/services/notifications/whatsapp";

const schema = z.object({
  courtReference: z.string().min(1).max(200).optional(),
});

type Props = { params: Promise<{ matchId: string }> };

export async function POST(request: Request, { params }: Props) {
  try {
    const { matchId } = await params;
    const body = await request.json().catch(() => ({}));
    const { courtReference } = schema.parse(body);

    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Verify the caller is the host of this match
    const { data: match } = await supabase
      .from("matches")
      .select("id, host_player_id, status")
      .eq("id", matchId)
      .maybeSingle();

    if (!match) {
      return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
    }
    if (match.host_player_id !== user.id) {
      return NextResponse.json({ error: "Solo el organizador puede activar este partido" }, { status: 403 });
    }
    if (match.status !== "pending_court") {
      return NextResponse.json({ error: "El partido ya está activo" }, { status: 409 });
    }

    const admin = getSupabaseAdminClient();
    const { error } = await admin
      .from("matches")
      .update({
        status: "open",
        ...(courtReference ? { court_reference: courtReference } : {}),
      })
      .eq("id", matchId);

    if (error) throw error;

    // Fetch host profile and match data for notifications
    const [{ data: hostProfile }, { data: matchData }] = await Promise.all([
      admin.from("profiles").select("full_name, phone, whatsapp_phone").eq("id", user.id).maybeSingle(),
      admin.from("matches").select("venue_name, scheduled_at, max_players").eq("id", matchId).maybeSingle(),
    ]);

    const hostName = hostProfile?.full_name ?? "Un jugador";
    const venueName = matchData?.venue_name ?? "partido";
    const scheduledAt = matchData?.scheduled_at ?? null;
    const maxPlayers = matchData?.max_players ?? 4;
    const hostPhone = hostProfile?.whatsapp_phone?.trim() || hostProfile?.phone?.trim() || null;

    // Notify owner
    try {
      await notifyOwnerNewGame({ matchId, hostName, venueName, scheduledAt });
    } catch (err) {
      console.error("[WhatsApp] notifyOwnerNewGame failed", err);
    }

    // Notify the host themselves
    if (hostPhone) {
      try {
        await notifyHostMatchCreated({ hostPhone, hostName, matchId, venueName, scheduledAt, maxPlayers });
      } catch (err) {
        console.error("[WhatsApp] notifyHostMatchCreated failed", err);
      }
    }

    // Pre-create checkout for the host so they can pay on the match page
    try {
      await createCheckoutForMatch(matchId, { isHost: true });
    } catch {
      // Non-fatal — host can pay from the match page
    }

    return NextResponse.json({ ok: true, payUrl: `/matches/${matchId}?pay=1` });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : (error as { message?: string })?.message ?? "Error al activar el partido";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
