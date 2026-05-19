import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createCheckoutForMatch } from "@/services/payments/service";
import { notifyOwnerNewGame } from "@/services/notifications/whatsapp";

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

    // Notify owner that a new game was just created
    const { data: hostProfile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    const { data: matchData } = await admin
      .from("matches")
      .select("venue_name, scheduled_at")
      .eq("id", matchId)
      .maybeSingle();

    notifyOwnerNewGame({
      matchId,
      hostName: hostProfile?.full_name ?? "Un jugador",
      venueName: matchData?.venue_name ?? "partido",
      scheduledAt: matchData?.scheduled_at ?? null,
    }).catch(() => {});

    // Auto-create checkout for the host so they pay their own spot
    let checkoutUrl: string | undefined;
    try {
      const checkout = await createCheckoutForMatch(matchId, { isHost: true });
      checkoutUrl = checkout.checkoutUrl;
    } catch {
      // Non-fatal — host can pay from the match page
    }

    return NextResponse.json({ ok: true, ...(checkoutUrl ? { checkoutUrl } : {}) });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : (error as { message?: string })?.message ?? "Error al activar el partido";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
