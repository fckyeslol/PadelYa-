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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
