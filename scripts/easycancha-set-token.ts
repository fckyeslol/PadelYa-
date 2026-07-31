/**
 * Guarda un authtoken de EasyCancha capturado A MANO en easycancha_accounts.
 *
 *   EC_TOKEN='eyJ...' npx tsx scripts/easycancha-set-token.ts <id> [awsalb]
 *   npx tsx scripts/easycancha-set-token.ts <id> <token> [awsalb]
 *
 * Preferí EC_TOKEN por env para no dejar el JWT en el historial del shell.
 * Decodifica el exp del JWT para setear expires_at correctamente.
 */
import { readFileSync } from "node:fs";
import { getSupabase, loadEnvLocal, upsertToken } from "./easycancha-token-store";

async function main(): Promise<void> {
  loadEnvLocal();
  const id = Number(process.argv[2]);
  const tokenFromFile = process.env.EC_TOKEN_FILE
    ? readFileSync(process.env.EC_TOKEN_FILE, "utf8").trim()
    : "";
  const token = (tokenFromFile || process.env.EC_TOKEN || process.argv[3] || "").trim();
  const awsalb = (process.env.EC_AWSALB ?? process.argv[4] ?? "").trim() || null;

  if (!Number.isInteger(id) || !token) {
    console.error("uso: EC_TOKEN='eyJ...' npx tsx scripts/easycancha-set-token.ts <id> [awsalb]");
    process.exit(1);
  }

  const supabase = getSupabase();
  const expMs = await upsertToken(supabase, id, token, awsalb);
  console.log(`✓ Cuenta ${id} guardada (${token.length} chars)`);
  if (expMs) {
    const days = Math.round((expMs - Date.now()) / 86_400_000);
    console.log(`  expira: ${new Date(expMs).toLocaleString("es-CO")} (~${days} días)`);
  } else {
    console.warn("  ⚠ no pude decodificar exp del JWT: expires_at quedó null.");
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
