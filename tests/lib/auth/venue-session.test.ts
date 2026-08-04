/**
 * Sesión del portal de sedes: el token va en una cookie httpOnly firmada con
 * HMAC-SHA256. Si la firma se puede falsificar o el vencimiento no se respeta,
 * cualquiera entra como cualquier sede — por eso estos casos son de seguridad,
 * no de formato.
 *
 * `lib/auth/venue.ts` importa `cookies()` de next/headers, que sólo existe
 * dentro del request de Next. Se mockea con un jar en memoria para poder
 * ejercitar el ciclo completo set -> get -> clear.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const SECRET = "un-secreto-de-pruebas-con-mas-de-32-chars";

type CookieOpts = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
  path?: string;
  maxAge?: number;
};

const jar = new Map<string, { value: string; opts: CookieOpts }>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const hit = jar.get(name);
      return hit ? { name, value: hit.value } : undefined;
    },
    set: (name: string, value: string, opts: CookieOpts = {}) => {
      jar.set(name, { value, opts });
    },
    delete: (name: string) => {
      jar.delete(name);
    },
  }),
}));

const {
  COOKIE_NAME,
  clearVenueSessionCookie,
  getVenueSession,
  requireVenueSession,
  setVenueSessionCookie,
} = await import("@/lib/auth/venue");

const SESSION = {
  accountId: "acc-1",
  venueId: "x3-padel-club",
  username: "x3",
  venueName: "X3 Pádel Club",
};

function readToken(): string {
  const raw = jar.get(COOKIE_NAME);
  if (!raw) throw new Error("no hay cookie de sesión");
  return raw.value;
}

beforeEach(() => {
  jar.clear();
  vi.unstubAllEnvs();
  vi.stubEnv("VENUE_SESSION_SECRET", SECRET);
  vi.useRealTimers();
});

describe("ciclo de vida de la sesión", () => {
  it("un round-trip devuelve los mismos datos de la sede", async () => {
    await setVenueSessionCookie(SESSION);
    const session = await getVenueSession();

    expect(session).toMatchObject(SESSION);
    expect(session?.exp).toBeGreaterThan(Date.now());
  });

  it("sin cookie no hay sesión", async () => {
    expect(await getVenueSession()).toBeNull();
  });

  it("clear borra la cookie y deja la sesión en null", async () => {
    await setVenueSessionCookie(SESSION);
    await clearVenueSessionCookie();

    expect(jar.has(COOKIE_NAME)).toBe(false);
    expect(await getVenueSession()).toBeNull();
  });

  it("vence a los 14 días", async () => {
    await setVenueSessionCookie(SESSION);
    const { exp } = (await getVenueSession())!;

    const dias = (exp - Date.now()) / (24 * 60 * 60 * 1000);
    expect(dias).toBeGreaterThan(13.9);
    expect(dias).toBeLessThan(14.1);
  });
});

describe("la cookie no es accesible desde JS ni viaja en claro", () => {
  it("se marca httpOnly, sameSite lax y path raíz", async () => {
    await setVenueSessionCookie(SESSION);
    const { opts } = jar.get(COOKIE_NAME)!;

    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
    expect(opts.path).toBe("/");
  });

  it("secure sólo en producción, para que el dev en http siga funcionando", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await setVenueSessionCookie(SESSION);
    expect(jar.get(COOKIE_NAME)!.opts.secure).toBe(false);

    jar.clear();
    vi.stubEnv("NODE_ENV", "production");
    await setVenueSessionCookie(SESSION);
    expect(jar.get(COOKIE_NAME)!.opts.secure).toBe(true);
  });
});

describe("rechazo de tokens manipulados", () => {
  it("rechaza si el payload se edita conservando la firma vieja", async () => {
    await setVenueSessionCookie(SESSION);
    const [, sig] = readToken().split(".");

    // La sede se cambia por otra: es el ataque que importa.
    const suplantado = Buffer.from(
      JSON.stringify({ ...SESSION, venueId: "casa-padel", exp: Date.now() + 60_000 }),
    ).toString("base64url");

    jar.set(COOKIE_NAME, { value: `${suplantado}.${sig}`, opts: {} });
    expect(await getVenueSession()).toBeNull();
  });

  it("rechaza una firma alterada", async () => {
    await setVenueSessionCookie(SESSION);
    const [payload, sig] = readToken().split(".");
    const alterada = (sig[0] === "A" ? "B" : "A") + sig.slice(1);

    jar.set(COOKIE_NAME, { value: `${payload}.${alterada}`, opts: {} });
    expect(await getVenueSession()).toBeNull();
  });

  it.each([
    ["sin punto separador", "solo-un-payload-sin-firma"],
    ["payload vacío", ".unafirma"],
    ["firma vacía", "unpayload."],
    ["cadena vacía", ""],
    ["base64 inválido", "no-es-base64!!!.tampoco"],
  ])("rechaza un token %s", async (_caso, token) => {
    jar.set(COOKIE_NAME, { value: token, opts: {} });
    expect(await getVenueSession()).toBeNull();
  });

  it("rechaza un token firmado con otro secreto", async () => {
    await setVenueSessionCookie(SESSION);
    const token = readToken();

    // Mismo token, servidor con otro secreto: no debe validar.
    vi.stubEnv("VENUE_SESSION_SECRET", "otro-secreto-igual-de-largo-para-hmac!!");
    jar.set(COOKIE_NAME, { value: token, opts: {} });

    expect(await getVenueSession()).toBeNull();
  });

  it("rechaza un payload que no es JSON aunque la firma sea válida", async () => {
    const { createHmac } = await import("node:crypto");
    const payload = Buffer.from("esto no es json").toString("base64url");
    const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");

    jar.set(COOKIE_NAME, { value: `${payload}.${sig}`, opts: {} });
    expect(await getVenueSession()).toBeNull();
  });

  it.each(["accountId", "venueId", "exp"])(
    "rechaza un payload bien firmado al que le falta %s",
    async (campo) => {
      const { createHmac } = await import("node:crypto");
      const incompleto: Record<string, unknown> = { ...SESSION, exp: Date.now() + 60_000 };
      delete incompleto[campo];

      const payload = Buffer.from(JSON.stringify(incompleto)).toString("base64url");
      const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");

      jar.set(COOKIE_NAME, { value: `${payload}.${sig}`, opts: {} });
      expect(await getVenueSession()).toBeNull();
    },
  );
});

describe("vencimiento", () => {
  it("una sesión vencida se rechaza aunque la firma sea legítima", async () => {
    const { createHmac } = await import("node:crypto");
    const vencida = { ...SESSION, exp: Date.now() - 1_000 };
    const payload = Buffer.from(JSON.stringify(vencida)).toString("base64url");
    const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");

    jar.set(COOKIE_NAME, { value: `${payload}.${sig}`, opts: {} });
    expect(await getVenueSession()).toBeNull();
  });

  it("la sesión emitida hoy deja de valer pasados los 14 días", async () => {
    await setVenueSessionCookie(SESSION);
    expect(await getVenueSession()).not.toBeNull();

    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000));
    expect(await getVenueSession()).toBeNull();
  });
});

describe("requireVenueSession", () => {
  it("devuelve la sesión cuando hay una válida", async () => {
    await setVenueSessionCookie(SESSION);
    await expect(requireVenueSession()).resolves.toMatchObject(SESSION);
  });

  it("tira el error que venueRouteError traduce a 401", async () => {
    await expect(requireVenueSession()).rejects.toThrow("Venue session required");
  });
});

describe("secreto de firma", () => {
  it("en producción exige el secreto y no cae al de desarrollo", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VENUE_SESSION_SECRET", "");

    await expect(setVenueSessionCookie(SESSION)).rejects.toThrow(/VENUE_SESSION_SECRET/);
  });

  it("en producción rechaza un secreto más corto que 32 chars", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VENUE_SESSION_SECRET", "corto");

    await expect(setVenueSessionCookie(SESSION)).rejects.toThrow(/min 32 chars/);
  });

  it("fuera de producción usa un fallback para no bloquear el dev local", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VENUE_SESSION_SECRET", "");

    await setVenueSessionCookie(SESSION);
    expect(await getVenueSession()).toMatchObject(SESSION);
  });
});
