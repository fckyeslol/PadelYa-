/**
 * URLs de auth. Dos cosas críticas acá:
 *
 * 1. `getAppUrl()` tiene que emitir SIEMPRE el dominio con www en producción. El
 *    apex hace 307 a www, y como las cookies de sesión son host-only, si auth
 *    emite el apex la cookie se setea ahí y se pierde en el salto: el usuario
 *    termina deslogueado. Está documentado en el header del módulo.
 * 2. `isAllowedAuthOrigin()` es el guard contra redirect abierto: decide a qué
 *    origen se puede devolver al usuario después de autenticarse.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  PRODUCTION_APP_URL,
  buildAuthCallbackUrl,
  buildMagicLinkFromHashedToken,
  getAppUrl,
  isAllowedAuthOrigin,
  normalizeAppUrl,
  resolveAuthRedirectOrigin,
} from "@/utils/auth-url";

beforeEach(() => {
  vi.unstubAllEnvs();
  // El entorno real de test hereda .env.local; se limpia para partir de cero.
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
  vi.stubEnv("VERCEL_URL", "");
  vi.stubEnv("VERCEL", "");
});

describe("normalizeAppUrl", () => {
  it.each([
    ["el apex, que redirige a www", "https://padelya.co"],
    ["la preview vieja de Vercel", "https://padel-ya.vercel.app"],
    ["el apex con slash final", "https://padelya.co/"],
    ["el apex sin protocolo", "padelya.co"],
  ])("reescribe %s al dominio canónico", (_caso, url) => {
    expect(normalizeAppUrl(url)).toBe(PRODUCTION_APP_URL);
  });

  it("deja pasar el dominio canónico tal cual", () => {
    expect(normalizeAppUrl(PRODUCTION_APP_URL)).toBe(PRODUCTION_APP_URL);
  });

  it("saca el slash final sin tocar el resto", () => {
    expect(normalizeAppUrl("http://localhost:3000/")).toBe("http://localhost:3000");
  });

  it("no toca una preview nueva de Vercel", () => {
    const url = "https://padel-ya-git-feat-x.vercel.app";
    expect(normalizeAppUrl(url)).toBe(url);
  });

  it("devuelve la entrada recortada si no parsea como URL", () => {
    expect(normalizeAppUrl("no es una url/")).toBe("no es una url");
  });
});

describe("getAppUrl", () => {
  it("usa NEXT_PUBLIC_APP_URL cuando está configurada", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.padelya.co");
    expect(getAppUrl()).toBe("https://www.padelya.co");
  });

  it("normaliza el apex a www: es el bug de la cookie perdida", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://padelya.co");
    expect(getAppUrl()).toBe(PRODUCTION_APP_URL);
  });

  it("ignora el valor 'placeholder'", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "placeholder");
    expect(getAppUrl()).toBe("http://localhost:3000");
  });

  it("cae a localhost cuando no hay nada configurado", () => {
    expect(getAppUrl()).toBe("http://localhost:3000");
  });

  it("prefiere el host de Vercel antes que un NEXT_PUBLIC_APP_URL con localhost", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "www.padelya.co");

    expect(getAppUrl()).toBe(PRODUCTION_APP_URL);
  });

  it("VERCEL_PROJECT_PRODUCTION_URL gana sobre VERCEL_URL", () => {
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "www.padelya.co");
    vi.stubEnv("VERCEL_URL", "otra-preview.vercel.app");

    expect(getAppUrl()).toBe(PRODUCTION_APP_URL);
  });

  it("usa VERCEL_URL si la otra no está", () => {
    vi.stubEnv("VERCEL_URL", "preview-abc.vercel.app");
    expect(getAppUrl()).toBe("https://preview-abc.vercel.app");
  });

  it("le agrega https al host de Vercel que viene sin protocolo", () => {
    vi.stubEnv("VERCEL_URL", "preview-abc.vercel.app");
    expect(getAppUrl()).toMatch(/^https:\/\//);
  });

  it("con VERCEL=1 y sin host usable devuelve el dominio de producción", () => {
    vi.stubEnv("VERCEL", "1");
    expect(getAppUrl()).toBe(PRODUCTION_APP_URL);
  });

  it("nunca devuelve localhost cuando corre en Vercel", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("VERCEL_URL", "http://localhost:3000");

    expect(getAppUrl()).toBe(PRODUCTION_APP_URL);
  });
});

describe("isAllowedAuthOrigin", () => {
  it.each([
    ["el apex", "https://padelya.co"],
    ["el canónico con www", "https://www.padelya.co"],
    ["localhost para dev", "http://localhost:3000"],
    ["127.0.0.1 para dev", "http://127.0.0.1:3000"],
  ])("acepta %s", (_caso, origin) => {
    expect(isAllowedAuthOrigin(origin)).toBe(true);
  });

  it.each([
    ["otro dominio", "https://evil.com"],
    ["javascript:", "javascript:alert(1)"],
    ["data:", "data:text/html,<script>alert(1)</script>"],
    ["file:", "file:///etc/passwd"],
    ["basura", "no-es-una-url"],
    ["vacío", ""],
    ["un dominio que sólo contiene el nuestro", "https://padelya.co.evil.com"],
    ["un sufijo parecido", "https://notpadelya.co"],
  ])("rechaza %s", (_caso, origin) => {
    expect(isAllowedAuthOrigin(origin)).toBe(false);
  });

  // Comportamiento actual, documentado a propósito: el guard acepta CUALQUIER
  // subdominio de vercel.app, no sólo los del proyecto. Cualquiera puede
  // desplegar en vercel.app, así que esto es más ancho de lo necesario.
  // Ver la nota en el PR: conviene acotarlo a un prefijo del proyecto.
  it("acepta cualquier *.vercel.app (más ancho de lo necesario)", () => {
    expect(isAllowedAuthOrigin("https://padel-ya-git-feat.vercel.app")).toBe(true);
    expect(isAllowedAuthOrigin("https://cualquier-cosa-ajena.vercel.app")).toBe(true);
  });

  it("acepta el host de getAppUrl aunque no esté en la lista fija", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.padelya.dev");
    expect(isAllowedAuthOrigin("https://staging.padelya.dev")).toBe(true);
  });
});

describe("resolveAuthRedirectOrigin", () => {
  it("usa el origen del request cuando está permitido", () => {
    expect(resolveAuthRedirectOrigin("https://www.padelya.co")).toBe("https://www.padelya.co");
  });

  it("normaliza el apex del request a www", () => {
    expect(resolveAuthRedirectOrigin("https://padelya.co")).toBe(PRODUCTION_APP_URL);
  });

  it("descarta un origen no permitido y cae a getAppUrl", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.padelya.co");
    expect(resolveAuthRedirectOrigin("https://evil.com")).toBe("https://www.padelya.co");
  });

  it.each([undefined, "", "   "])("cae a getAppUrl con un origen %o", (origin) => {
    expect(resolveAuthRedirectOrigin(origin)).toBe("http://localhost:3000");
  });
});

describe("buildAuthCallbackUrl", () => {
  it("arma la ruta de callback", () => {
    expect(buildAuthCallbackUrl("https://www.padelya.co")).toBe(
      "https://www.padelya.co/auth/callback",
    );
  });

  it("no duplica el slash si el origen lo trae", () => {
    expect(buildAuthCallbackUrl("https://www.padelya.co/")).toBe(
      "https://www.padelya.co/auth/callback",
    );
  });

  it("agrega y codifica el next relativo", () => {
    expect(buildAuthCallbackUrl("https://www.padelya.co", "/matches/abc")).toBe(
      "https://www.padelya.co/auth/callback?next=%2Fmatches%2Fabc",
    );
  });

  it.each([
    ["absoluto a otro dominio", "https://evil.com"],
    ["protocol-relative", "//evil.com"],
    ["sin slash inicial", "matches"],
  ])("ignora un next %s: cortaría en redirect abierto", (_caso, next) => {
    expect(buildAuthCallbackUrl("https://www.padelya.co", next)).toBe(
      "https://www.padelya.co/auth/callback",
    );
  });
});

describe("buildMagicLinkFromHashedToken", () => {
  it("agrega token_hash y type", () => {
    const url = new URL(
      buildMagicLinkFromHashedToken("https://www.padelya.co/auth/callback", "abc123"),
    );

    expect(url.searchParams.get("token_hash")).toBe("abc123");
    expect(url.searchParams.get("type")).toBe("magiclink");
  });

  it("acepta type signup", () => {
    const url = new URL(
      buildMagicLinkFromHashedToken("https://www.padelya.co/auth/callback", "abc", "signup"),
    );

    expect(url.searchParams.get("type")).toBe("signup");
  });

  it("conserva el next que ya traía el callback", () => {
    const url = new URL(
      buildMagicLinkFromHashedToken(
        "https://www.padelya.co/auth/callback?next=%2Fmatches",
        "abc",
      ),
    );

    expect(url.searchParams.get("next")).toBe("/matches");
    expect(url.searchParams.get("token_hash")).toBe("abc");
  });
});
