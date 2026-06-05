/**
 * Refresca el authtoken de EasyCancha vía login real con Playwright.
 *
 *   npx tsx scripts/easycancha-refresh-token.ts            # navegador visible (recomendado)
 *   npx tsx scripts/easycancha-refresh-token.ts --headless # sin ventana
 *
 * Requiere en .env.local:
 *   EASYCANCHA_EMAIL=tu@email.com
 *   EASYCANCHA_PASSWORD=tu-clave
 *
 * Escribe el token en .firecrawl/session.json (gitignored), que es lo que lee
 * scripts/easycancha_fetch_4weeks.py.
 *
 * IMPORTANTE: el login corre reCAPTCHA v3 (score) + detección de abuso (código -48).
 * Por eso usamos un navegador real con perfil persistente y tipeo humano, y conviene
 * correrlo ESPACIADO: el token dura ~7 días, no lo pongas en un loop.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { type BrowserContext, chromium, type Page } from "playwright";

const ROOT = process.cwd();
const SESSION_PATH = resolve(ROOT, ".firecrawl", "session.json");
const PROFILE_DIR = resolve(ROOT, ".firecrawl", ".browser-profile");
const LOGIN_URL = "https://www.easycancha.com/login?lang=es-CO&country=CO";

/** Endpoint conocido-bueno para validar que el token funciona (un club de BAQ). */
function validateUrl(): string {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  return `https://www.easycancha.com/api/sports/7/clubs/1125/timeslots?date=${today}&time=18:00&timespan=90`;
}

function loadEnvLocal(): void {
  try {
    const raw = readFileSync(resolve(ROOT, ".env.local"), "utf8");
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
    /* .env.local opcional si las vars ya están en el entorno */
  }
}

function decodeJwtExpMs(token: string): number | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function readAuthToken(ctx: BrowserContext): Promise<string> {
  const cookies = await ctx.cookies("https://www.easycancha.com");
  return cookies.find((c) => c.name === "authtoken")?.value ?? "";
}

/** Confirma que el token devuelve datos reales (no 401/error). */
async function tokenWorks(page: Page, token: string): Promise<boolean> {
  try {
    return await page.evaluate(
      async ({ url, tok }) => {
        const r = await fetch(url, {
          headers: {
            Authorization: tok,
            Accept: "application/json",
            "app-id": "easycancha",
            "app-os": "web",
            country: "CO",
            acceptLanguage: "es-CO",
          },
        });
        if (!r.ok) return false;
        const d = await r.json().catch(() => null);
        return !!d && !d.error;
      },
      { url: validateUrl(), tok: token },
    );
  } catch {
    return false;
  }
}

async function humanType(page: Page, selector: string, text: string): Promise<void> {
  const field = page.locator(selector);
  await field.waitFor({ state: "visible", timeout: 30_000 });
  await field.click();
  await field.pressSequentially(text, { delay: 60 + Math.floor(Math.random() * 90) });
}

async function waitForToken(ctx: BrowserContext, page: Page, timeoutMs: number): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const t = await readAuthToken(ctx);
    if (t) return t;
    await page.waitForTimeout(500);
  }
  return "";
}

/** Empuja el token a Supabase (easycancha_session) para que lo lea el cron de Vercel. */
async function pushToSupabase(token: string, awsalb: string, expMs: number | null): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("  (Supabase no configurado: token solo local; el cron no lo verá)");
    return;
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await supabase.from("easycancha_session").upsert({
    id: 1,
    token,
    awsalb,
    expires_at: expMs ? new Date(expMs).toISOString() : null,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error(`  Supabase upsert falló: ${error.message}`);
  else console.log("  ✓ Token guardado también en Supabase (easycancha_session) para el cron");
}

async function main(): Promise<void> {
  loadEnvLocal();
  const email = process.env.EASYCANCHA_EMAIL?.trim();
  const password = process.env.EASYCANCHA_PASSWORD?.trim();
  if (!email || !password) {
    console.error("Faltan EASYCANCHA_EMAIL / EASYCANCHA_PASSWORD en .env.local");
    process.exit(1);
  }
  const headless = process.argv.includes("--headless");

  mkdirSync(PROFILE_DIR, { recursive: true });
  let ctx: BrowserContext;
  try {
    ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
      headless,
      locale: "es-CO",
      timezoneId: "America/Bogota",
      viewport: { width: 1280, height: 800 },
    });
  } catch (e) {
    console.error(`No pude lanzar Chromium: ${(e as Error).message}`);
    console.error("Probá: npx playwright install chromium");
    process.exit(1);
  }

  try {
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });

    // El perfil persistente puede traer una sesión todavía válida → evitá re-loguear.
    let token = await readAuthToken(ctx);
    let reused = false;
    if (token && (await tokenWorks(page, token))) {
      reused = true;
    } else {
      console.log("Logueando…");
      await humanType(page, 'input[name="email"]', email);
      await humanType(page, 'input[name="password"]', password);
      await page.getByRole("button", { name: "Ingresar" }).click();
      token = await waitForToken(ctx, page, 45_000);
      if (!token) {
        throw new Error(
          "El login no dejó authtoken. Causas probables: credenciales, score de reCAPTCHA v3 bajo, " +
            "o cuenta marcada por abuso (-48). Probá sin --headless y/o esperá un rato.",
        );
      }
      if (!(await tokenWorks(page, token))) {
        throw new Error("Se obtuvo un token pero la validación falló (401/error).");
      }
    }

    const cookies = await ctx.cookies("https://www.easycancha.com");
    const awsalb = cookies.find((c) => c.name === "AWSALB")?.value ?? "";
    const expMs = decodeJwtExpMs(token);

    mkdirSync(dirname(SESSION_PATH), { recursive: true });
    writeFileSync(
      SESSION_PATH,
      `${JSON.stringify(
        {
          token,
          awsalb,
          savedAt: new Date().toISOString(),
          expiresAt: expMs ? new Date(expMs).toISOString() : null,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    console.log(`✓ Token ${reused ? "reusado de la sesión" : "obtenido"} y guardado en .firecrawl/session.json`);
    console.log(`  ${token.slice(0, 12)}…${token.slice(-6)} (${token.length} chars)`);
    if (expMs) {
      const days = Math.round((expMs - Date.now()) / 86_400_000);
      console.log(`  expira: ${new Date(expMs).toLocaleString("es-CO")} (~${days} días)`);
    }
    await pushToSupabase(token, awsalb, expMs);
  } finally {
    await ctx.close();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
