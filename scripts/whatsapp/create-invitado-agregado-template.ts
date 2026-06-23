/**
 * Crea (envía a aprobación) la plantilla de WhatsApp `invitado_agregado`, que
 * notifica a un jugador NO registrado que fue agregado a un partido y su cupo
 * quedó pago. La usa notifyGuestAdded en services/notifications/whatsapp.ts.
 *
 * Debe coincidir EXACTO con lo que envía el código:
 *   bodyParams: [guestName, inviterName, venueName, date]   → {{1}}..{{4}}
 *   button URL dinámico: https://www.padelya.co/matches/{{1}}  (matchId)
 *
 * Uso:
 *   1. En .env.local (o exporta) un token PERMANENTE con permiso
 *      whatsapp_business_messaging y el id de la WABA:
 *        WA_ACCESS_TOKEN=...
 *        WA_BUSINESS_ACCOUNT_ID=1523829129435558
 *   2. npx tsx scripts/whatsapp/create-invitado-agregado-template.ts
 *
 * Queda en estado PENDING hasta que Meta la apruebe.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const GRAPH_API_VERSION = "v23.0";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      const key = t.slice(0, i);
      const val = t.slice(i + 1);
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // no .env.local — rely on real env vars
  }
}

async function main() {
  loadEnvLocal();

  const token = process.env.WA_ACCESS_TOKEN;
  const wabaId = process.env.WA_BUSINESS_ACCOUNT_ID;
  if (!token || !wabaId) {
    console.error(
      "Faltan WA_ACCESS_TOKEN y/o WA_BUSINESS_ACCOUNT_ID. Configúralos en .env.local o como env vars.",
    );
    process.exit(1);
  }

  const template = {
    name: "invitado_agregado",
    language: "es",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "🎾 ¡Hola {{1}}! {{2}} te agregó a un partido de pádel y ya pagó tu cupo. " +
          "Es en {{3}} el {{4}}. No necesitas cuenta — solo llega y juega. " +
          "Toca el botón para ver los detalles.",
        example: {
          // [guestName, inviterName, venueName, date]
          body_text: [["Carlos", "Mateo", "Pádel Park", "vie 5 jun · 18:00"]],
        },
      },
      {
        type: "FOOTER",
        text: "PadelYa · Pádel en Barranquilla",
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "Ver partido",
            url: "https://www.padelya.co/matches/{{1}}",
            example: ["https://www.padelya.co/matches/abc123"],
          },
        ],
      },
    ],
  };

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/message_templates`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(template),
    },
  );

  const json = await res.json();
  if (!res.ok) {
    console.error(`Error creando la plantilla (${res.status}):`, JSON.stringify(json, null, 2));
    process.exit(1);
  }
  console.log("Plantilla 'invitado_agregado' enviada a aprobación:", JSON.stringify(json, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
