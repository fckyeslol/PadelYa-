import { NextResponse } from "next/server";
import { requireOrganizerUser } from "@/lib/auth/organizer";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendRefundProcessedEmail } from "@/services/notifications/email";

export async function PATCH(request: Request) {
  try {
    await requireOrganizerUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { refundId: string; status: "processed" | "rejected" };
  if (!body.refundId || !["processed", "rejected"].includes(body.status)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from("refunds")
    .update({ status: body.status })
    .eq("id", body.refundId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send confirmation email to the player when organizer marks a refund as processed.
  if (body.status === "processed") {
    try {
      const { data: refundDetail } = await admin
        .from("refunds")
        .select("amount_cop, payment_id")
        .eq("id", body.refundId)
        .maybeSingle();

      if (refundDetail?.payment_id) {
        const { data: paymentDetail } = await admin
          .from("payments")
          .select("match_player_id, match_id")
          .eq("id", refundDetail.payment_id)
          .maybeSingle();

        if (paymentDetail) {
          const [{ data: matchPlayerDetail }, { data: matchDetail }] = await Promise.all([
            admin
              .from("match_players")
              .select("player_id")
              .eq("id", paymentDetail.match_player_id)
              .maybeSingle(),
            admin
              .from("matches")
              .select("venue_name, scheduled_at")
              .eq("id", paymentDetail.match_id)
              .maybeSingle(),
          ]);

          if (matchPlayerDetail?.player_id) {
            const [{ data: authUser }, { data: profile }] = await Promise.all([
              admin.auth.admin.getUserById(matchPlayerDetail.player_id),
              admin
                .from("profiles")
                .select("full_name")
                .eq("id", matchPlayerDetail.player_id)
                .maybeSingle(),
            ]);

            const playerEmail = authUser?.user?.email;
            if (playerEmail) {
              const playerName =
                profile?.full_name ??
                (authUser.user.user_metadata?.full_name as string | undefined) ??
                "Jugador";
              const matchVenue = matchDetail?.venue_name ?? "Tu partido de pádel";
              const matchDate = matchDetail?.scheduled_at
                ? new Date(matchDetail.scheduled_at).toLocaleString("es-CO", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "Fecha por confirmar";

              await sendRefundProcessedEmail({
                playerEmail,
                playerName,
                amountCop: refundDetail.amount_cop,
                matchVenue,
                matchDate,
              });
            }
          }
        }
      }
    } catch (emailErr) {
      // Email failure must never block the API response.
      console.error("[refunds] Failed to send refund confirmation email", emailErr);
    }
  }

  return NextResponse.json({ ok: true });
}
