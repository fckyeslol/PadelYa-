/**
 * Asistente de reserva manual: cuando un partido llega a 4/4, avisa al equipo con todo
 * lo necesario para ir a reservar y pagar la cancha. La reserva siempre fue manual.
 *
 * El WhatsApp de "partido lleno" al owner lo manda notifyMatchFull; acá sumamos el email
 * con el detalle (a OWNER_EMAIL, multi) + el WhatsApp al equipo (plantilla reserva_cancha,
 * a TEAM_WHATSAPP_PHONES). Sede que no se reserva por EasyCancha → no hace nada.
 *
 * Vivía en services/easycancha/booking-alert.ts. Se movió acá el 2026-07-30 al eliminar el
 * scraping: ya no consulta canchas libres ni precio scrapeado — el precio sale de las
 * reglas de config/venue-pricing-rules.ts, que es la misma fuente con la que se le cobra
 * al jugador.
 */
import { easycanchaBookingUrl, easycanchaClubIdForVenueId } from "@/config/easycancha";
import { bogotaDateAndTime } from "@/config/pricing";
import { getVenueInfo } from "@/config/venues";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveCourtPriceCop } from "@/services/pricing/resolver";
import { sendCourtBookingEmail } from "@/services/notifications/email";
import { notifyTeamCourtToBook } from "@/services/notifications/whatsapp";
import { formatCop } from "@/utils/currency";

/** Duración normalizada a las que soportan las reglas. */
function toRuleDuration(minutes: number): 60 | 90 | 120 {
  return minutes === 60 ? 60 : minutes === 120 ? 120 : 90;
}

export async function sendCourtBookingHandoff(params: {
  matchId: string;
  venueName: string;
  scheduledAt: string | null;
}): Promise<void> {
  const { matchId, venueName, scheduledAt } = params;
  if (!scheduledAt) return;

  const info = getVenueInfo(venueName);
  const clubId = info ? easycanchaClubIdForVenueId(info.id) : null;
  if (info == null || clubId == null) return; // sede fuera de EasyCancha (ej. Casa Padel)

  const { date, time } = bogotaDateAndTime(scheduledAt);
  const admin = getSupabaseAdminClient();

  const { data: match } = await admin
    .from("matches")
    .select("duration_minutes")
    .eq("id", matchId)
    .maybeSingle();

  const durationMinutes = (match?.duration_minutes as number | null | undefined) ?? 90;

  // Precio a pagarle al club: el que cargó la sede en su portal, o el del tarifario estático.
  const priceCop = await resolveCourtPriceCop(
    venueName,
    date,
    time,
    toRuleDuration(durationMinutes),
  );

  const whenDate = new Date(`${date}T12:00:00Z`).toLocaleDateString("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "America/Bogota",
  });

  await Promise.all([
    sendCourtBookingEmail({
      matchId,
      venueName,
      date,
      time,
      durationMinutes,
      priceCop,
      bookingUrl: easycanchaBookingUrl(clubId),
    }),
    notifyTeamCourtToBook({
      venueName,
      whenStr: `${whenDate} · ${time}`,
      priceStr: priceCop != null ? formatCop(priceCop) : "—",
      courtsInfo: "verificar en EasyCancha",
    }),
  ]);
}
