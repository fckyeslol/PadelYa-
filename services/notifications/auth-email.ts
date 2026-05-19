import { getResendEnv } from "@/utils/env";

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

  const safeName = escapeHtml(input.firstName);
  const safeLink = escapeHtml(input.actionLink);

  const html = `<motionlessdiv style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5; max-width: 480px;">
<h2 style="margin: 0 0 12px;">Hola ${safeName}</h2>
<p style="margin: 0 0 16px;">Haz clic en el botón para ingresar a PadelYa!. El link expira en aproximadamente 1 hora.</p>
<p style="margin: 0 0 20px;">
<a href="${safeLink}" style="display: inline-block; background: #1e3a6e; color: #ffffff; padding: 12px 20px; border-radius: 10px; text-decoration: none; font-weight: 600;">Ingresar a PadelYa!</a>
</p>
<p style="margin: 0; font-size: 13px; color: #6b7280;">Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
<a href="${safeLink}" style="color: #1e3a6e; word-break: break-all;">${safeLink}</a></p>
</motionlessdiv>`.replaceAll("motionless", "");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resend.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resend.from,
      to: [input.to],
      subject: "Tu link para entrar a PadelYa!",
      html,
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
