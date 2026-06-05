/**
 * Asistente de reserva manual (#3 v1): cuando un partido llega a 4/4, avisa al equipo
 * con todo para reservar y pagar la cancha en EasyCancha. La reserva sigue siendo manual.
 *
 * El WhatsApp de "partido lleno" al owner ya lo manda notifyMatchFull; acá sumamos el
 * email con el detalle (a OWNER_EMAIL, multi) + el WhatsApp al equipo (reserva_cancha,
 * a TEAM_WHATSAPP_PHONES). Sede fuera de EasyCancha → no hace nada.
 */
import { EASYCANCHA_BASE_URL, PADEL_SPORT_ID } from "@/config/easycancha";
import { bogotaDateAndTime } from "@/config/pricing";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendCourtBookingEmail } from "@/services/notifications/email";
import { notifyTeamCourtToBook } from "@/services/notifications/whatsapp";
import { formatCop } from "@/utils/currency";
import { easycanchaClubIdForVenueName } from "./availability";

export async function sendCourtBookingHandoff(params: {
  matchId: string;
  venueName: string;
  scheduledAt: string | null;
}): Promise<void> {
  const { matchId, venueName, scheduledAt } = params;
  const clubId = easycanchaClubIdForVenueName(venueName);
  if (clubId == null || !scheduledAt) return; // sede fuera de EasyCancha (ej. Casa Padel)

  const { date, time } = bogotaDateAndTime(scheduledAt);
  const admin = getSupabaseAdminClient();

  const [{ data: slots }, { data: match }] = await Promise.all([
    admin
      .from("easycancha_slots")
      .select("court_name, price_cop")
      .eq("club_id", clubId)
      .eq("slot_date", date)
      .eq("start_time", `${time}:00`)
      .eq("is_free", true),
    admin.from("matches").select("duration_minutes").eq("id", matchId).maybeSingle(),
  ]);

  const freeCourtNames = (slots ?? []).map((r) => (r.court_name as string | null) ?? "Cancha");
  const priceCop = (slots?.[0]?.price_cop as number | null | undefined) ?? null;
  const durationMinutes = (match?.duration_minutes as number | null | undefined) ?? 90;
  const bookingUrl = `${EASYCANCHA_BASE_URL}/book/clubs/${clubId}/sports?sportId=${PADEL_SPORT_ID}&lang=es-CO&country=CO`;

  const whenDate = new Date(`${date}T12:00:00Z`).toLocaleDateString("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "America/Bogota",
  });
  const whenStr = `${whenDate} · ${time}`;
  const priceStr = priceCop != null ? formatCop(priceCop) : "—";
  const courtsInfo = freeCourtNames.length ? `${freeCourtNames.length} libre(s)` : "0 libres";

  await Promise.all([
    sendCourtBookingEmail({
      matchId,
      venueName,
      date,
      time,
      durationMinutes,
      freeCourtNames,
      priceCop,
      bookingUrl,
    }),
    notifyTeamCourtToBook({ venueName, whenStr, priceStr, courtsInfo }),
  ]);
}
