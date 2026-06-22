import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createCheckoutForMatch } from "@/services/payments/service";
import { notifyAllUsersNewMatch, notifyHostMatchCreated } from "@/services/notifications/whatsapp";
import { sendNewMatchBroadcastEmail } from "@/services/notifications/email";

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

    // Check if the host is an organizer (creates matches but doesn't play)
    const [{ data: hostProfile }, { data: matchData }, { data: hostProfileRole }] = await Promise.all([
      admin.from("profiles").select("full_name, phone, whatsapp_phone").eq("id", user.id).maybeSingle(),
      admin
        .from("matches")
        .select("venue_name, scheduled_at, max_players, skill_level, org_fee_cop")
        .eq("id", matchId)
        .maybeSingle(),
      admin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    ]);

    const isOrganizerHost = hostProfileRole?.role === "organizer";

    const hostName = hostProfile?.full_name ?? "Un jugador";
    const venueName = matchData?.venue_name ?? "partido";
    const scheduledAt = matchData?.scheduled_at ?? null;
    const maxPlayers = matchData?.max_players ?? 4;
    const skillLevel = matchData?.skill_level ?? "intermediate";
    const feeCop = matchData?.org_fee_cop ?? 0;
    const hostPhone = hostProfile?.whatsapp_phone?.trim() || hostProfile?.phone?.trim() || null;

    // Notify the host that their match is published (partido_creado)
    if (hostPhone) {
      try {
        await notifyHostMatchCreated({ hostPhone, hostName, matchId, venueName, scheduledAt, maxPlayers });
      } catch (err) {
        console.error("[WhatsApp] notifyHostMatchCreated failed", err);
      }
    }

    // Broadcast the new match to the owner + every registered user (nuevo_partido)
    try {
      await notifyAllUsersNewMatch({
        matchId,
        venueName,
        scheduledAt,
        skillLevel,
        feeCop,
        excludePlayerId: user.id,
      });
    } catch (err) {
      console.error("[WhatsApp] notifyAllUsersNewMatch failed", err);
    }

    // Email broadcast to all registered users
    try {
      const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const emails = (authUsers?.users ?? [])
        .filter((u) => u.id !== user.id && u.email)
        .map((u) => u.email!);

      if (emails.length > 0) {
        await sendNewMatchBroadcastEmail({
          to: emails,
          venueName,
          scheduledAt,
          skillLevel,
          feeCop,
          matchId,
        });
      }
    } catch (err) {
      console.error("[Email] broadcast failed", err);
    }

    // Organizers don't take a player slot — skip checkout entirely.
    // Regular hosts get a pre-created checkout so they can pay on the match page.
    if (!isOrganizerHost) {
      try {
        await createCheckoutForMatch(matchId);
      } catch {
        // Non-fatal — host can pay from the match page
      }
    }

    const payUrl = isOrganizerHost
      ? `/matches/${matchId}`
      : `/matches/${matchId}?pay=1`;

    return NextResponse.json({ ok: true, payUrl });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : (error as { message?: string })?.message ?? "Error al activar el partido";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
