import { getResendEnv } from "@/utils/env";
import { buildTransactionalEmail } from "@/services/notifications/email-template";

type MagicLinkEmailInput = {
  to: string;
  firstName: string;
  actionLink: string;
};

export async function sendMagicLinkEmail(input: MagicLinkEmailInput): Promise<void> {
  const resend = getResendEnv();
  if (!resend) {
    throw new Error("RESEND_NOT_CONFIGURED");
  }

  const greeting = `Hola, ${input.firstName}`;
  const html = buildTransactionalEmail({
    preheader: "Tu acceso a PadelYa! — válido por aproximadamente 1 hora.",
    greeting,
    paragraphs: [
      "Solicitaste entrar a PadelYa! Usa el botón de abajo para continuar de forma segura.",
      "Por tu tranquilidad, este enlace caduca en aproximadamente una hora y solo puede usarse una vez.",
    ],
    ctaLabel: "Continuar a PadelYa!",
    ctaHref: input.actionLink,
    footnote: "Si no solicitaste este correo, puedes ignorarlo con tranquilidad.",
  });

  const text = [
    greeting,
    "",
    "Solicitaste entrar a PadelYa! Abre este enlace para continuar (válido ~1 hora):",
    input.actionLink,
    "",
    "Si no solicitaste este correo, ignóralo.",
    "",
    "— PadelYa! · Barranquilla",
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resend.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resend.from,
      to: [input.to],
      subject: "Tu acceso a PadelYa!",
      html,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    let message = body || `Resend error ${response.status}`;
    try {
      const parsed = JSON.parse(body) as { message?: string };
      if (parsed.message) message = parsed.message;
    } catch {
      // keep raw body
    }
    throw new Error(message);
  }
}
