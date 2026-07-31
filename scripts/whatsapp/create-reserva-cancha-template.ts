/**
 * Crea (envía a aprobación) la plantilla de WhatsApp `reserva_cancha`, que el
 * código usa en notifyTeamCourtToBook pero que NO existe aún en Meta.
 *
 * Es body-only (4 variables, sin header ni botón) para coincidir EXACTO con lo
 * que envía services/notifications/whatsapp.ts:
 *   bodyParams: [venueName, whenStr, priceStr, courtsInfo]
 *
 * Uso:
 *   1. Pon en .env.local (o exporta) un token PERMANENTE con permiso
 *      whatsapp_business_messaging y el id de la WABA:
 *        WA_ACCESS_TOKEN=...
 *        WA_BUSINESS_ACCOUNT_ID=1523829129435558
 *   2. npx tsx scripts/whatsapp/create-reserva-cancha-template.ts
 *
 * Tras correrlo, la plantilla queda en estado PENDING hasta que Meta la apruebe.
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
    name: "reserva_cancha",
    language: "es",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "🎾 ¡Partido lleno! Reserva la cancha en {{1}} para el {{2}}. " +
          "Precio: {{3}}. Canchas: {{4}}. Hazlo en EasyCancha.",
        example: {
          // [venueName, whenStr, priceStr (precio cancha), courtsInfo (canchas libres)]
          body_text: [["La Jaula", "vie 5 jun · 18:00", "$90.000", "2 libre(s)"]],
        },
      },
      {
        type: "FOOTER",
        text: "PadelYa · Pádel en Barranquilla",
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
  console.log("Plantilla 'reserva_cancha' enviada a aprobación:", JSON.stringify(json, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
