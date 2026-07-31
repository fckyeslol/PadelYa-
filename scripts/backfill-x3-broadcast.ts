/**
 * Reenvía el broadcast "nuevo partido" del partido de X3 Pádel Club (d617b893) a los
 * 32 usuarios que NO lo recibieron por el bug de rate-limit (Promise.all contra el
 * endpoint individual de Resend; ya corregido a /emails/batch).
 *
 *   npx tsx scripts/backfill-x3-broadcast.ts
 *
 * Excluye al host y a los 5 que sí lo recibieron (juliette418, samueldargoltz,
 * castroestefania50, cabarcas201, juanpablo990305). Uso único; se puede borrar luego.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sendNewMatchBroadcastEmail } from "../services/notifications/email";

const ROOT = resolve(__dirname, "..");

function loadEnvLocal(): void {
  try {
    const raw = readFileSync(resolve(ROOT, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      const key = t.slice(0, i);
      if (!process.env[key]) process.env[key] = t.slice(i + 1);
    }
  } catch {
    /* .env.local opcional si las vars ya están en el entorno */
  }
}

const RECIPIENTS = [
  "aledelavegan@gmail.com",
  "andresfelipeparada113@gmail.com",
  "cabarcastar@gmail.com",
  "cabarcasthor@gmail.com",
  "cachapiita15@gmail.com",
  "cristhyandiazz7@gmail.com",
  "cristiancp.125.cp@gmail.com",
  "danilopezu2504@gmail.com",
  "ellinjazmin@gmail.com",
  "emilysofia0823@gmail.com",
  "insignaresnicol@gmail.com",
  "iruzalarcon@gmail.com",
  "jborrero26@gmail.com",
  "jesusadrianardila88@gmail.com",
  "jesusadrianareila88@gmail.com",
  "jgomezc94@outlook.com",
  "kelviscorrea@gmail.com",
  "lpulidomarquez@hotmail.com",
  "marhormiga@gmail.com",
  "mateopirela@30x.com",
  "matteotaofr@gmail.com",
  "nestorbarraganpolo@gmail.com",
  "orlandodazaorozco2609@gmail.com",
  "pirelapulidomateodejesus@gmail.com",
  "raul.escalante07ps@gmail.com",
  "roastmyspreadsheet@gmail.com",
  "roastmyspreadsheets@gmail.com",
  "santieljach322@gmail.com",
  "scaballerogutierrez21@gmail.com",
  "stevenmejia00@hotmail.com",
  "valerieglogreira@gmail.com",
  "yamidbadran0528@gmail.com",
];

async function main(): Promise<void> {
  loadEnvLocal();

  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY no está configurada en .env.local");
  }

  console.log(`Reenviando broadcast de X3 Pádel Club a ${RECIPIENTS.length} destinatarios…`);

  await sendNewMatchBroadcastEmail({
    to: RECIPIENTS,
    venueName: "X3 Pádel Club",
    scheduledAt: "2026-06-17T20:00:00+00:00",
    skillLevel: "intermediate",
    feeCop: 22875,
    matchId: "d617b893-49d5-4023-b4dd-06d759fc9851",
  });

  console.log("Listo. Revisa el dashboard de Resend para confirmar las entregas.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
