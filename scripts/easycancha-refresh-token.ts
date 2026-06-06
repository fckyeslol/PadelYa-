/**
 * Refresca los authtoken de las 6 cuentas de EasyCancha vía login real con Playwright.
 *
 *   npx tsx scripts/easycancha-refresh-token.ts             # todas, navegador visible
 *   npx tsx scripts/easycancha-refresh-token.ts --headless  # todas, sin ventana
 *   npx tsx scripts/easycancha-refresh-token.ts --only=3    # solo la cuenta id=3
 *
 * Credenciales en .env.local como JSON (recomendado):
 *   EASYCANCHA_ACCOUNTS=[{"id":1,"email":"a@x.com","password":"..."}, ... 6 cuentas]
 * Fallback (1 cuenta): EASYCANCHA_EMAIL / EASYCANCHA_PASSWORD -> id 1.
 *
 * Cada cuenta usa su propio perfil persistente (.firecrawl/.browser-profile-<id>) y, si
 * tiene proxy_url en easycancha_accounts, loguea POR ESE proxy (mismo IP residencial que
 * usará el sync para leer → login y lecturas coherentes). Escribe token + expires_at; el
 * scheduling (next_run_at) NO se toca acá.
 *
 * IMPORTANTE: el login corre reCAPTCHA v3 (score) + detección de abuso (código -48).
 * Por eso: navegador real, perfil persistente, tipeo humano, y ESPACIADO entre cuentas.
 * El token dura ~7 días: no lo pongas en un loop agresivo.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { type BrowserContext, chromium, type Page } from "playwright";

const ROOT = process.cwd();
const LOGIN_URL = "https://www.easycancha.com/login?lang=es-CO&country=CO";
const ACCOUNT_GAP_MIN_MS = 20_000; // espaciado entre cuentas (anti-abuso)
const ACCOUNT_GAP_MAX_MS = 60_000;

type Account = { id: number; email: string; password: string };
type PlaywrightProxy = { server: string; username?: string; password?: string };

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** "http://user:pass@host:port" -> { server, username, password } para Playwright. */
function parseProxy(proxyUrl: string): PlaywrightProxy | undefined {
  if (!proxyUrl) return undefined;
  try {
    const u = new URL(proxyUrl);
    return {
      server: `${u.protocol}//${u.host}`, // host incluye el puerto
      username: u.username ? decodeURIComponent(u.username) : undefined,
      password: u.password ? decodeURIComponent(u.password) : undefined,
    };
  } catch {
    return undefined;
  }
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
      if (!process.env[key]) process.env[key] = t.slice(i + 1);
    }
  } catch {
    /* .env.local opcional si las vars ya están en el entorno */
  }
}

function loadAccounts(): Account[] {
  const json = process.env.EASYCANCHA_ACCOUNTS?.trim();
  if (json) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error("EASYCANCHA_ACCOUNTS no es JSON válido.");
    }
    if (!Array.isArray(parsed)) throw new Error("EASYCANCHA_ACCOUNTS debe ser un array.");
    const accounts = parsed.map((a, idx) => {
      const obj = a as Record<string, unknown>;
      const id = Number(obj.id ?? idx + 1);
      const email = String(obj.email ?? "").trim();
      const password = String(obj.password ?? "").trim();
      if (!id || !email || !password) {
        throw new Error(`Cuenta inválida en EASYCANCHA_ACCOUNTS (índice ${idx}).`);
      }
      return { id, email, password };
    });
    return accounts;
  }
  // Fallback: una sola cuenta.
  const email = process.env.EASYCANCHA_EMAIL?.trim();
  const password = process.env.EASYCANCHA_PASSWORD?.trim();
  if (email && password) return [{ id: 1, email, password }];
  throw new Error("Faltan credenciales: definí EASYCANCHA_ACCOUNTS (JSON) o EASYCANCHA_EMAIL/PASSWORD.");
}

function decodeJwtExpMs(token: string): number | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function validateUrl(): string {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  return `https://www.easycancha.com/api/sports/7/clubs/1125/timeslots?date=${today}&time=18:00&timespan=90`;
}

async function readAuthToken(ctx: BrowserContext): Promise<string> {
  const cookies = await ctx.cookies("https://www.easycancha.com");
  return cookies.find((c) => c.name === "authtoken")?.value ?? "";
}

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

async function pushAccount(
  supabase: SupabaseClient | null,
  id: number,
  token: string,
  awsalb: string,
  expMs: number | null,
): Promise<void> {
  if (!supabase) {
    console.warn("  (Supabase no configurado: token no persistido; el cron no lo verá)");
    return;
  }
  const { error } = await supabase.from("easycancha_accounts").upsert({
    id,
    token,
    awsalb,
    expires_at: expMs ? new Date(expMs).toISOString() : null,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error(`  Supabase upsert cuenta ${id} falló: ${error.message}`);
  else console.log(`  ✓ Cuenta ${id} guardada en easycancha_accounts`);
}

async function refreshAccount(
  account: Account,
  headless: boolean,
  supabase: SupabaseClient | null,
  proxy: PlaywrightProxy | undefined,
): Promise<boolean> {
  const profileDir = resolve(ROOT, ".firecrawl", `.browser-profile-${account.id}`);
  mkdirSync(profileDir, { recursive: true });
  if (proxy) console.log(`  proxy: ${proxy.server}`);

  let ctx: BrowserContext;
  try {
    ctx = await chromium.launchPersistentContext(profileDir, {
      headless,
      locale: "es-CO",
      timezoneId: "America/Bogota",
      viewport: { width: 1280, height: 800 },
      serviceWorkers: "block", // evita 503 cacheado por la PWA
      ...(proxy ? { proxy } : {}),
    });
  } catch (e) {
    console.error(`  No pude lanzar Chromium: ${(e as Error).message}`);
    console.error("  Probá: npx playwright install chromium");
    return false;
  }

  try {
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });

    let token = await readAuthToken(ctx);
    let reused = false;
    if (token && (await tokenWorks(page, token))) {
      reused = true;
    } else {
      console.log(`  Logueando ${account.email}…`);
      await humanType(page, 'input[name="email"]', account.email);
      await humanType(page, 'input[name="password"]', account.password);
      await page.getByRole("button", { name: "Ingresar" }).click();
      token = await waitForToken(ctx, page, 45_000);
      if (!token) {
        throw new Error(
          "El login no dejó authtoken (credenciales, score de reCAPTCHA bajo, o abuso -48).",
        );
      }
      if (!(await tokenWorks(page, token))) {
        throw new Error("Se obtuvo un token pero la validación falló (401/error).");
      }
    }

    const cookies = await ctx.cookies("https://www.easycancha.com");
    const awsalb = cookies.find((c) => c.name === "AWSALB")?.value ?? "";
    const expMs = decodeJwtExpMs(token);

    console.log(`  ✓ Cuenta ${account.id} token ${reused ? "reusado" : "obtenido"} (${token.length} chars)`);
    if (expMs) {
      const days = Math.round((expMs - Date.now()) / 86_400_000);
      console.log(`    expira: ${new Date(expMs).toLocaleString("es-CO")} (~${days} días)`);
    }
    await pushAccount(supabase, account.id, token, awsalb, expMs);
    return true;
  } catch (e) {
    console.error(`  ✗ Cuenta ${account.id}: ${e instanceof Error ? e.message : e}`);
    return false;
  } finally {
    await ctx.close();
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  const headless = process.argv.includes("--headless");
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const onlyId = onlyArg ? Number(onlyArg.split("=")[1]) : null;

  let accounts = loadAccounts();
  if (onlyId != null) accounts = accounts.filter((a) => a.id === onlyId);
  if (!accounts.length) {
    console.error(onlyId != null ? `No existe la cuenta id=${onlyId}` : "No hay cuentas.");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

  // Proxy por cuenta: fuente de verdad = easycancha_accounts.proxy_url.
  const proxyById = new Map<number, string>();
  if (supabase) {
    const { data } = await supabase.from("easycancha_accounts").select("id, proxy_url");
    for (const r of data ?? []) {
      if (r.proxy_url) proxyById.set(r.id as number, r.proxy_url as string);
    }
  }

  console.log(`Refrescando ${accounts.length} cuenta(s)…`);
  let ok = 0;
  for (let i = 0; i < accounts.length; i++) {
    console.log(`\n=== Cuenta ${accounts[i].id} (${accounts[i].email}) ===`);
    const proxy = parseProxy(proxyById.get(accounts[i].id) ?? "");
    if (await refreshAccount(accounts[i], headless, supabase, proxy)) ok += 1;
    // Espaciar logins para no gatillar la detección de abuso.
    if (i < accounts.length - 1) {
      const gap = ACCOUNT_GAP_MIN_MS + Math.random() * (ACCOUNT_GAP_MAX_MS - ACCOUNT_GAP_MIN_MS);
      console.log(`  …esperando ${Math.round(gap / 1000)}s antes de la próxima cuenta`);
      await sleep(gap);
    }
  }

  console.log(`\nListo: ${ok}/${accounts.length} cuenta(s) refrescada(s).`);
  if (ok === 0) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
