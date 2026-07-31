/**
 * Captura interactiva del authtoken de EasyCancha.
 *
 * Abre un navegador VISIBLE en el login, PRE-LLENA email+password de cada cuenta,
 * y espera a que VOS aprietes "Ingresar" y resuelvas el captcha. Cuando aparece la
 * cookie authtoken, la valida y la guarda en easycancha_accounts. Sin copiar nada
 * a mano (cero riesgo de corromper el JWT).
 *
 *   npx tsx scripts/easycancha-manual-login.ts --only=1,2,3,4
 *   npx tsx scripts/easycancha-manual-login.ts --only=2
 *
 * NO usa proxy: logueás desde tu IP y el JWT es IP-independiente para la API
 * (el sync sigue leyendo por el proxy residencial, sin problema). Cada cuenta usa
 * un contexto de navegador limpio, así nunca captura una cookie vieja.
 */
import { type BrowserContext, chromium, type Page } from "playwright";
import { getSupabase, loadAccounts, loadEnvLocal, upsertToken, type Account } from "./easycancha-token-store";

const LOGIN_URL = "https://www.easycancha.com/login?lang=es-CO&country=CO";
const WAIT_MIN = 8; // tiempo por cuenta para loguear + captcha

function validateUrl(): string {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  return `https://www.easycancha.com/api/sports/7/clubs/1125/timeslots?date=${today}&time=18:00&timespan=90`;
}

async function readCookie(ctx: BrowserContext, name: string): Promise<string> {
  const cookies = await ctx.cookies("https://www.easycancha.com");
  return cookies.find((c) => c.name === name)?.value ?? "";
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

async function prefill(page: Page, account: Account): Promise<void> {
  try {
    const email = page.locator('input[name="email"]');
    await email.waitFor({ state: "visible", timeout: 20_000 });
    await email.fill(account.email);
    await page.locator('input[name="password"]').fill(account.password);
    console.log("  Credenciales pre-llenadas. Apretá 'Ingresar' y resolvé el captcha.");
  } catch {
    console.log(`  (No pude pre-llenar; escribí a mano: ${account.email})`);
  }
}

async function waitForToken(ctx: BrowserContext, page: Page, minutes: number): Promise<string> {
  const deadline = Date.now() + minutes * 60_000;
  while (Date.now() < deadline) {
    const t = await readCookie(ctx, "authtoken");
    if (t) return t;
    await page.waitForTimeout(1_000);
  }
  return "";
}

async function capture(account: Account, supabase: ReturnType<typeof getSupabase>): Promise<boolean> {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({
    locale: "es-CO",
    timezoneId: "America/Bogota",
    viewport: { width: 1280, height: 800 },
  });
  try {
    console.log(`\n=== Cuenta ${account.id} (${account.email}) ===`);
    const page = await ctx.newPage();
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
    await prefill(page, account);
    console.log(`  Esperando authtoken (hasta ${WAIT_MIN} min)…`);

    const token = await waitForToken(ctx, page, WAIT_MIN);
    if (!token) {
      console.error(`  ✗ Cuenta ${account.id}: no apareció authtoken en ${WAIT_MIN} min.`);
      return false;
    }
    if (!(await tokenWorks(page, token))) {
      console.log("  ⚠ Token capturado pero la validación falló; lo guardo igual.");
    }
    const awsalb = await readCookie(ctx, "AWSALB");
    const expMs = await upsertToken(supabase, account.id, token, awsalb || null);
    console.log(`  ✓ Cuenta ${account.id} guardada (${token.length} chars)`);
    if (expMs) {
      const days = Math.round((expMs - Date.now()) / 86_400_000);
      console.log(`    expira: ${new Date(expMs).toLocaleString("es-CO")} (~${days} días)`);
    } else {
      console.warn("    ⚠ no pude decodificar exp: expires_at quedó null.");
    }
    return true;
  } catch (e) {
    console.error(`  ✗ Cuenta ${account.id}: ${e instanceof Error ? e.message : e}`);
    return false;
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const onlyIds = onlyArg
    ? onlyArg
        .split("=")[1]
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n))
    : null;

  let accounts = loadAccounts();
  if (onlyIds?.length) accounts = accounts.filter((a) => onlyIds.includes(a.id));
  if (!accounts.length) {
    console.error(onlyIds?.length ? `No existe ninguna cuenta ${onlyIds.join(",")}` : "No hay cuentas.");
    process.exit(1);
  }

  const supabase = getSupabase();
  console.log(`Captura interactiva de ${accounts.length} cuenta(s). Se abren de a una.`);

  let ok = 0;
  for (const account of accounts) {
    if (await capture(account, supabase)) ok += 1;
  }
  console.log(`\nListo: ${ok}/${accounts.length} cuenta(s) capturada(s).`);
  if (ok === 0) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
