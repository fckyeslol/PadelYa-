/**
 * Abre un navegador real ruteado por el proxy de UNA cuenta, para registrarte o revisar
 * a mano en EasyCancha DESDE su IP residencial de Barranquilla (footprint consistente:
 * registro + login + lecturas, todo desde el mismo IP).
 *
 *   npx tsx scripts/easycancha-open.ts 2          # abre como la cuenta 2 (perfil + proxy)
 *   npm run easycancha:open 2
 *
 * Lee el proxy_url de la cuenta desde easycancha_accounts (Supabase). Usa el MISMO perfil
 * persistente que el refresh (.firecrawl/.browser-profile-<id>), así la sesión que dejes
 * logueada acá la reusa después `npm run easycancha:token`. Dejá la ventana abierta,
 * registrate/verificá, y cerrala cuando termines.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { type BrowserContext, chromium } from "playwright";

const ROOT = process.cwd();
const START_URL = "https://www.easycancha.com/?lang=es-CO&country=CO";

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
    /* opcional */
  }
}

function parseProxy(proxyUrl: string): { server: string; username?: string; password?: string } | undefined {
  if (!proxyUrl) return undefined;
  try {
    const u = new URL(proxyUrl);
    return {
      server: `${u.protocol}//${u.host}`,
      username: u.username ? decodeURIComponent(u.username) : undefined,
      password: u.password ? decodeURIComponent(u.password) : undefined,
    };
  } catch {
    return undefined;
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  const id = Number(process.argv[2]);
  if (!id) {
    console.error("uso: npx tsx scripts/easycancha-open.ts <id>   (ej: 2)");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from("easycancha_accounts")
    .select("proxy_url")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error(`No pude leer la cuenta ${id}: ${error.message}`);
    process.exit(1);
  }
  const proxy = parseProxy((data?.proxy_url as string | null) ?? "");

  const profileDir = resolve(ROOT, ".firecrawl", `.browser-profile-${id}`);
  mkdirSync(profileDir, { recursive: true });

  console.log(`Abriendo EasyCancha como cuenta ${id}${proxy ? ` vía ${proxy.server}` : " (SIN proxy)"}…`);
  if (!proxy) console.warn("⚠️ Esta cuenta no tiene proxy_url; saldrías por tu IP real.");

  const ctx: BrowserContext = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    locale: "es-CO",
    timezoneId: "America/Bogota",
    viewport: { width: 1280, height: 800 },
    // Bloquear el service worker de la PWA: evita que EasyCancha cachee/repita un 503.
    serviceWorkers: "block",
    ...(proxy ? { proxy } : {}),
  });

  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(START_URL, { waitUntil: "domcontentloaded" });
  console.log("Listo. Registrate / verificá a mano. Cerrá la ventana cuando termines.");

  await new Promise<void>((res) => ctx.on("close", () => res()));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
