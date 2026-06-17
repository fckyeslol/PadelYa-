import { getEasycanchaClub } from "@/config/easycancha";
import { formatCop } from "@/utils/currency";
import { getResendEnv } from "@/utils/env";

type PaymentStatus = "approved" | "declined" | "voided";

type PaymentStatusEmailInput = {
  to: string;
  playerName: string;
  matchVenueName: string;
  matchScheduledAt: string | null;
  amountCop: number;
  status: PaymentStatus;
};

const STATUS_COPY: Record<
  PaymentStatus,
  { subjectPrefix: string; headline: string; description: string }
> = {
  approved: {
    subjectPrefix: "Pago confirmado",
    headline: "Tu cupo quedó confirmado",
    description: "Ya puedes ver el partido en la app y coordinar por el chat.",
  },
  declined: {
    subjectPrefix: "Pago rechazado",
    headline: "No pudimos aprobar tu pago",
    description: "Intenta de nuevo con otro método de pago para reservar tu cupo.",
  },
  voided: {
    subjectPrefix: "Pago anulado",
    headline: "Tu intento de pago fue anulado",
    description: "Puedes volver a intentar desde el detalle del partido.",
  },
};

export async function sendPaymentStatusEmail(input: PaymentStatusEmailInput) {
  const resend = getResendEnv();
  if (!resend) {
    return;
  }

  const copy = STATUS_COPY[input.status];
  const when = input.matchScheduledAt
    ? new Date(input.matchScheduledAt).toLocaleString("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Fecha por confirmar";
  const amount = formatCop(input.amountCop);
  const matchUrl = `${resend.appUrl}/matches`;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resend.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resend.from,
        to: [input.to],
        subject: `${copy.subjectPrefix} · PadelYa!`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
            <h2 style="margin: 0 0 12px;">${copy.headline}</h2>
            <p style="margin: 0 0 12px;">Hola ${escapeHtml(input.playerName)},</p>
            <p style="margin: 0 0 12px;">${copy.description}</p>
            <div style="margin: 14px 0; padding: 12px; border: 1px solid #e5e7eb; border-radius: 10px;">
              <p style="margin: 0 0 6px;"><strong>Partido:</strong> ${escapeHtml(input.matchVenueName)}</p>
              <p style="margin: 0 0 6px;"><strong>Fecha:</strong> ${escapeHtml(when)}</p>
              <p style="margin: 0;"><strong>Monto:</strong> ${escapeHtml(amount)}</p>
            </div>
            <p style="margin: 16px 0 0;">
              <a href="${matchUrl}" style="color: #111827; font-weight: 600;">Ver mis partidos</a>
            </p>
          </div>
        `,
      }),
    });
  } catch {
    // Email delivery should never break payment processing.
  }
}

type MatchFilledEmailInput = {
  to: string;
  hostName: string;
  matchVenueName: string;
  matchScheduledAt: string | null;
  matchId: string;
  appUrl: string;
};

export async function sendMatchFilledEmail(input: MatchFilledEmailInput) {
  const resend = getResendEnv();
  if (!resend) return;

  const when = input.matchScheduledAt
    ? new Date(input.matchScheduledAt).toLocaleString("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Fecha por confirmar";

  const matchUrl = `${input.appUrl}/matches/${input.matchId}`;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resend.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resend.from,
        to: [input.to],
        subject: "¡Tu partido se llenó! · PadelYa!",
        html: `
          <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5; max-width: 480px;">
            <h2 style="margin: 0 0 12px;">¡Tu partido está lleno!</h2>
            <p style="margin: 0 0 10px;">Hola ${escapeHtml(input.hostName)},</p>
            <p style="margin: 0 0 14px;">Los 4 cupos de tu partido en <strong>${escapeHtml(input.matchVenueName)}</strong> ya están pagados.</p>
            <div style="margin: 14px 0; padding: 12px; border: 1px solid #e5e7eb; border-radius: 10px;">
              <p style="margin: 0 0 6px;"><strong>Cancha:</strong> ${escapeHtml(input.matchVenueName)}</p>
              <p style="margin: 0;"><strong>Fecha:</strong> ${escapeHtml(when)}</p>
            </div>
            <p style="margin: 16px 0 0;">
              <a href="${matchUrl}" style="display: inline-block; background: #1e3a6e; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                Ver partido →
              </a>
            </p>
          </div>
        `,
      }),
    });
  } catch {
    // Non-fatal — don't break payment processing
  }
}

export type RefundProcessedEmailInput = {
  playerEmail: string;
  playerName: string;
  amountCop: number;
  matchVenue: string;
  matchDate: string;
};

export async function sendRefundProcessedEmail(input: RefundProcessedEmailInput) {
  const resend = getResendEnv();
  if (!resend) return;

  const amount = formatCop(input.amountCop);

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resend.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resend.from,
        to: [input.playerEmail],
        subject: "Tu devolución ha sido procesada — PadelYa!",
        html: `
          <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5; max-width: 480px;">
            <h2 style="margin: 0 0 12px;">Tu devolución ha sido procesada</h2>
            <p style="margin: 0 0 12px;">Hola ${escapeHtml(input.playerName)},</p>
            <p style="margin: 0 0 12px;">
              Tu devolución de <strong>${escapeHtml(amount)}</strong> ha sido procesada exitosamente.
              El valor aparecerá reflejado en tu cuenta en un plazo de 3 a 5 días hábiles.
            </p>
            <div style="margin: 14px 0; padding: 12px; border: 1px solid #e5e7eb; border-radius: 10px;">
              <p style="margin: 0 0 6px;"><strong>Partido:</strong> ${escapeHtml(input.matchVenue)}</p>
              <p style="margin: 0 0 6px;"><strong>Fecha:</strong> ${escapeHtml(input.matchDate)}</p>
              <p style="margin: 0;"><strong>Monto devuelto:</strong> ${escapeHtml(amount)}</p>
            </div>
            <p style="margin: 16px 0 0; color: #6b7280; font-size: 14px;">
              Si tienes dudas sobre la devolución, contáctanos respondiendo este correo.
            </p>
          </div>
        `,
      }),
    });
  } catch {
    // Email delivery should never block the refund operation.
  }
}

export type FreedSlot = {
  clubId: number;
  courtName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM:SS
  priceCop: number | null;
};

/** Avisa que se liberaron turnos de EasyCancha que matchean un watch. */
export async function sendSlotsAvailableEmail(to: string, slots: FreedSlot[]) {
  const resend = getResendEnv();
  if (!resend || slots.length === 0) return;

  const rows = slots
    .map((s) => {
      const club = getEasycanchaClub(s.clubId)?.name ?? `Club ${s.clubId}`;
      const when = new Date(`${s.date}T12:00:00Z`).toLocaleDateString("es-CO", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "America/Bogota",
      });
      const price = s.priceCop != null ? formatCop(s.priceCop) : "—";
      return `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(club)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(when)} · ${escapeHtml(s.startTime.slice(0, 5))}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(s.courtName)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(price)}</td>
      </tr>`;
    })
    .join("");

  const count = slots.length;
  const subject =
    count === 1 ? "Se liberó una cancha · PadelYa!" : `Se liberaron ${count} canchas · PadelYa!`;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resend.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resend.from,
        to: [to],
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; color:#111827; line-height:1.5; max-width:560px;">
            <h2 style="margin:0 0 12px;">${count === 1 ? "Se liberó una cancha" : `Se liberaron ${count} canchas`}</h2>
            <p style="margin:0 0 14px;">Estos turnos pasaron de ocupados a libres en EasyCancha:</p>
            <table style="border-collapse:collapse;width:100%;font-size:14px;">
              <thead>
                <tr style="text-align:left;color:#6b7280;">
                  <th style="padding:6px 10px;">Club</th>
                  <th style="padding:6px 10px;">Cuándo</th>
                  <th style="padding:6px 10px;">Cancha</th>
                  <th style="padding:6px 10px;text-align:right;">Precio</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <p style="margin:16px 0 0;">
              <a href="https://www.easycancha.com/book/search?country=CO" style="color:#1e3a6e;font-weight:600;">Reservar en EasyCancha →</a>
            </p>
          </div>
        `,
      }),
    });
  } catch {
    // El email nunca debe romper el sync.
  }
}

export type CourtBookingHandoff = {
  matchId: string;
  venueName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  durationMinutes: number;
  freeCourtNames: string[];
  priceCop: number | null;
  bookingUrl: string; // link a EasyCancha
};

/**
 * Aviso al equipo (OWNER_EMAIL) cuando un partido llega a 4/4: hay que reservar y
 * pagar la cancha en EasyCancha. Trae todo para hacerlo en 30 segundos.
 */
export async function sendCourtBookingEmail(h: CourtBookingHandoff) {
  const resend = getResendEnv();
  // OWNER_EMAIL admite varias direcciones separadas por coma.
  const recipients = (process.env.OWNER_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (!resend || recipients.length === 0) return;

  const when = new Date(`${h.date}T12:00:00Z`).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Bogota",
  });
  const price = h.priceCop != null ? formatCop(h.priceCop) : "—";
  const matchUrl = `${resend.appUrl}/matches/${h.matchId}`;
  const courtsRow = h.freeCourtNames.length
    ? `<strong style="color:#16a34a;">${h.freeCourtNames.length} libre(s)</strong>: ${escapeHtml(h.freeCourtNames.join(", "))}`
    : `<strong style="color:#dc2626;">⚠️ 0 libres en EasyCancha ahora</strong> — reservá cuanto antes o coordiná alternativa`;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resend.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resend.from,
        to: recipients,
        subject: `🎾 Partido lleno — reservá la cancha · ${h.venueName}`,
        html: `
          <div style="font-family: Arial, sans-serif; color:#111827; line-height:1.5; max-width:520px;">
            <h2 style="margin:0 0 12px;">Partido lleno (4/4) — hay que reservar la cancha</h2>
            <p style="margin:0 0 14px;">Reservá y pagá la cancha en EasyCancha:</p>
            <div style="margin:14px 0; padding:12px; border:1px solid #e5e7eb; border-radius:10px;">
              <p style="margin:0 0 6px;"><strong>Sede:</strong> ${escapeHtml(h.venueName)}</p>
              <p style="margin:0 0 6px;"><strong>Cuándo:</strong> ${escapeHtml(when)} · ${escapeHtml(h.time)} (${h.durationMinutes} min)</p>
              <p style="margin:0 0 6px;"><strong>Precio a pagar en EasyCancha:</strong> ${escapeHtml(price)}</p>
              <p style="margin:0;"><strong>Canchas:</strong> ${courtsRow}</p>
            </div>
            <p style="margin:16px 0 8px;">
              <a href="${h.bookingUrl}" style="display:inline-block; background:#1e3a6e; color:#fff; padding:10px 20px; border-radius:8px; text-decoration:none; font-weight:600;">Reservar en EasyCancha →</a>
            </p>
            <p style="margin:8px 0 0;"><a href="${matchUrl}" style="color:#1e3a6e; font-weight:600;">Ver el partido en PadelYa</a></p>
          </div>
        `,
      }),
    });
  } catch {
    // El aviso nunca debe romper el cobro.
  }
}

export type NewMatchEmailInput = {
  to: string[];
  venueName: string;
  scheduledAt: string | null;
  skillLevel: string;
  feeCop: number;
  matchId: string;
};

const SKILL_LABELS_EMAIL: Record<string, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

export async function sendNewMatchBroadcastEmail(input: NewMatchEmailInput) {
  const resend = getResendEnv();
  if (!resend || input.to.length === 0) return;

  const when = input.scheduledAt
    ? new Date(input.scheduledAt).toLocaleString("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Fecha por confirmar";
  const level = SKILL_LABELS_EMAIL[input.skillLevel] ?? input.skillLevel;
  const price = formatCop(input.feeCop);
  const matchUrl = `${resend.appUrl}/matches/${input.matchId}`;

  const BATCH = 49;
  for (let i = 0; i < input.to.length; i += BATCH) {
    const slice = input.to.slice(i, i + BATCH);
    await Promise.all(
      slice.map((email) =>
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resend.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: resend.from,
            to: [email],
            subject: `Nuevo partido disponible en ${input.venueName} · PadelYa!`,
            html: `
              <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5; max-width: 480px;">
                <h2 style="margin: 0 0 12px;">¡Hay un nuevo partido!</h2>
                <p style="margin: 0 0 14px;">Se publicó un partido de pádel. ¿Te animas?</p>
                <div style="margin: 14px 0; padding: 12px; border: 1px solid #e5e7eb; border-radius: 10px;">
                  <p style="margin: 0 0 6px;"><strong>Cancha:</strong> ${escapeHtml(input.venueName)}</p>
                  <p style="margin: 0 0 6px;"><strong>Fecha:</strong> ${escapeHtml(when)}</p>
                  <p style="margin: 0 0 6px;"><strong>Nivel:</strong> ${escapeHtml(level)}</p>
                  <p style="margin: 0;"><strong>Precio:</strong> ${escapeHtml(price)} / jugador</p>
                </div>
                <p style="margin: 16px 0 0;">
                  <a href="${matchUrl}" style="display: inline-block; background: #1e3a6e; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                    Ver partido →
                  </a>
                </p>
                <p style="margin: 12px 0 0; color: #9ca3af; font-size: 12px;">
                  Recibes este correo porque tienes una cuenta en PadelYa.
                </p>
              </div>
            `,
          }),
        }).catch(() => {})
      )
    );
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
