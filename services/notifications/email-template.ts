/** Brand tokens — inline for email clients (no CSS variables). */
const BRAND = {
  navy: "#1E3A6E",
  navySoft: "#2B4F96",
  gold: "#C9922E",
  bg: "#EEF1F7",
  card: "#FFFFFF",
  border: "#E2E8F0",
  text: "#0F1629",
  textMuted: "#64748B",
  textSoft: "#94A3B8",
} as const;

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

type TransactionalEmailInput = {
  preheader: string;
  greeting: string;
  paragraphs: string[];
  ctaLabel: string;
  ctaHref: string;
  footnote?: string;
  fallbackHint?: string;
};

export function buildTransactionalEmail(input: TransactionalEmailInput): string {
  const safeGreeting = escapeHtml(input.greeting);
  const safeCtaHref = escapeHtml(input.ctaHref);
  const safeCtaLabel = escapeHtml(input.ctaLabel);
  const safePreheader = escapeHtml(input.preheader);
  const safeFootnote = input.footnote ? escapeHtml(input.footnote) : "";
  const safeFallbackHint =
    input.fallbackHint ?? "Si el botón no responde, copia y pega este enlace en tu navegador:";

  const bodyCopy = input.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 20px;font-size:16px;line-height:1.65;color:${BRAND.textMuted};font-weight:400;">${escapeHtml(p)}</p>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>PadelYa!</title>
  <!--[if mso]><style type="text/css">body,table,td{font-family:Arial,Helvetica,sans-serif!important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${BRAND.bg};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${BRAND.bg};opacity:0;">
    ${safePreheader}
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${BRAND.bg};">
    <tr>
      <td align="center" style="padding:48px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;">
          <!-- Wordmark -->
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:400;letter-spacing:-0.02em;color:${BRAND.navy};">
                Padel<span style="color:${BRAND.gold};">Ya!</span>
              </span>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background-color:${BRAND.card};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="height:3px;background:linear-gradient(90deg,${BRAND.navy} 0%,${BRAND.gold} 100%);font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:40px 36px 32px;">
                    <h1 style="margin:0 0 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:24px;font-weight:600;letter-spacing:-0.03em;line-height:1.25;color:${BRAND.text};">
                      ${safeGreeting}
                    </h1>
                    ${bodyCopy}
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 28px;">
                      <tr>
                        <td align="center" style="border-radius:10px;background-color:${BRAND.navy};">
                          <a href="${safeCtaHref}" target="_blank" style="display:inline-block;padding:15px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;letter-spacing:0.01em;color:#FFFFFF;text-decoration:none;border-radius:10px;">
                            ${safeCtaLabel}
                          </a>
                        </td>
                      </tr>
                    </table>
                    ${
                      safeFootnote
                        ? `<p style="margin:0 0 20px;font-size:13px;line-height:1.5;color:${BRAND.textSoft};">${safeFootnote}</p>`
                        : ""
                    }
                    <p style="margin:0;font-size:12px;line-height:1.55;color:${BRAND.textSoft};">
                      ${escapeHtml(safeFallbackHint)}<br />
                      <a href="${safeCtaHref}" style="color:${BRAND.navySoft};word-break:break-all;text-decoration:underline;">${safeCtaHref}</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding:28px 12px 0;">
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:${BRAND.textSoft};">
                PadelYa! · Barranquilla<br />
                <span style="color:${BRAND.textSoft};">Correo automático — no respondas a este mensaje.</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
