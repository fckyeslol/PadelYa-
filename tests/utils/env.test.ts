/**
 * Lectura de variables de entorno. La convención del repo es que el literal
 * "placeholder" cuenta como "sin configurar": permite arrancar la app sin claves
 * y que sólo se apaguen las features que las necesitan, en vez de romper todo.
 * Estos tests fijan esa convención en los dos sentidos — lo requerido tira error,
 * lo opcional devuelve null.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getResendEnv,
  getPublicSupabaseEnv,
  getWompiEventsSecret,
  getWompiIntegritySecret,
  getWompiPrivateKey,
  getWompiPublicKey,
  getWhatsAppAccessToken,
  getWhatsAppPhoneNumberId,
  isSupabaseConfigured,
} from "@/utils/env";

const TODAS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_WOMPI_PUBLIC_KEY",
  "WOMPI_INTEGRITY_SECRET",
  "WOMPI_WEBHOOK_SECRET",
  "WOMPI_PRIVATE_KEY",
  "WA_PHONE_NUMBER_ID",
  "WA_ACCESS_TOKEN",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "NEXT_PUBLIC_APP_URL",
];

beforeEach(() => {
  vi.unstubAllEnvs();
  // El proceso de test hereda .env.local, que tiene claves reales: se vacía todo
  // para que los casos no dependan de la máquina donde corre.
  for (const clave of TODAS) vi.stubEnv(clave, "");
});

describe("isSupabaseConfigured", () => {
  it("es true con url y anon key reales", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

    expect(isSupabaseConfigured()).toBe(true);
  });

  it.each([
    ["ambas en placeholder", "placeholder", "placeholder"],
    ["sólo la url en placeholder", "placeholder", "anon-key"],
    ["sólo la key en placeholder", "https://abc.supabase.co", "placeholder"],
    ["ambas vacías", "", ""],
    ["falta la key", "https://abc.supabase.co", ""],
  ])("es false con %s", (_caso, url, key) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", key);

    expect(isSupabaseConfigured()).toBe(false);
  });
});

describe("getPublicSupabaseEnv", () => {
  it("devuelve url y anonKey", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

    expect(getPublicSupabaseEnv()).toEqual({
      url: "https://abc.supabase.co",
      anonKey: "anon-key",
    });
  });

  it("nombra la variable que falta en el error", () => {
    expect(() => getPublicSupabaseEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("trata 'placeholder' como faltante", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "placeholder");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

    expect(() => getPublicSupabaseEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});

describe("claves de Wompi: son requeridas y tiran error con el nombre", () => {
  it.each([
    ["NEXT_PUBLIC_WOMPI_PUBLIC_KEY", getWompiPublicKey],
    ["WOMPI_INTEGRITY_SECRET", getWompiIntegritySecret],
    ["WOMPI_WEBHOOK_SECRET", getWompiEventsSecret],
    ["WOMPI_PRIVATE_KEY", getWompiPrivateKey],
  ])("%s falta -> error que la nombra", (nombre, getter) => {
    expect(() => getter()).toThrow(new RegExp(nombre));
  });

  it.each([
    ["NEXT_PUBLIC_WOMPI_PUBLIC_KEY", getWompiPublicKey],
    ["WOMPI_INTEGRITY_SECRET", getWompiIntegritySecret],
    ["WOMPI_WEBHOOK_SECRET", getWompiEventsSecret],
    ["WOMPI_PRIVATE_KEY", getWompiPrivateKey],
  ])("%s en placeholder también cuenta como faltante", (nombre, getter) => {
    vi.stubEnv(nombre, "placeholder");
    expect(() => getter()).toThrow(new RegExp(nombre));
  });

  it("devuelve el valor cuando está configurada", () => {
    vi.stubEnv("WOMPI_PRIVATE_KEY", "prv_test_123");
    expect(getWompiPrivateKey()).toBe("prv_test_123");
  });
});

describe("WhatsApp: es opcional, devuelve null", () => {
  it("null cuando no está configurado", () => {
    vi.unstubAllEnvs();
    vi.stubEnv("WA_PHONE_NUMBER_ID", "");
    vi.stubEnv("WA_ACCESS_TOKEN", "");

    // Cadena vacía => el ?? no la captura, pero tampoco es un id usable.
    expect(getWhatsAppPhoneNumberId() || null).toBeNull();
    expect(getWhatsAppAccessToken() || null).toBeNull();
  });

  it("devuelve los valores cuando están", () => {
    vi.stubEnv("WA_PHONE_NUMBER_ID", "123456");
    vi.stubEnv("WA_ACCESS_TOKEN", "token-abc");

    expect(getWhatsAppPhoneNumberId()).toBe("123456");
    expect(getWhatsAppAccessToken()).toBe("token-abc");
  });
});

describe("getResendEnv", () => {
  it("null sin api key: apaga los mails en vez de romper la request", () => {
    expect(getResendEnv()).toBeNull();
  });

  it("null con la api key en placeholder", () => {
    vi.stubEnv("RESEND_API_KEY", "placeholder");
    expect(getResendEnv()).toBeNull();
  });

  it("usa el remitente por defecto si no se configura", () => {
    vi.stubEnv("RESEND_API_KEY", "re_123");
    expect(getResendEnv()?.from).toBe("PadelYa <noreply@padelya.co>");
  });

  it("respeta un remitente propio", () => {
    vi.stubEnv("RESEND_API_KEY", "re_123");
    vi.stubEnv("RESEND_FROM_EMAIL", "Otro <hola@padelya.co>");

    expect(getResendEnv()?.from).toBe("Otro <hola@padelya.co>");
  });

  it("cae al default si el remitente son sólo espacios", () => {
    vi.stubEnv("RESEND_API_KEY", "re_123");
    vi.stubEnv("RESEND_FROM_EMAIL", "   ");

    expect(getResendEnv()?.from).toBe("PadelYa <noreply@padelya.co>");
  });

  it("incluye el appUrl para armar los links del mail", () => {
    vi.stubEnv("RESEND_API_KEY", "re_123");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.padelya.co");

    expect(getResendEnv()?.appUrl).toBe("https://www.padelya.co");
  });

  it("el appUrl nunca es el literal 'placeholder'", () => {
    // Era el bug de getAppUrl: con NEXT_PUBLIC_APP_URL=placeholder y sin Vercel,
    // los mails salían con links tipo `placeholder/matches/...`.
    vi.stubEnv("RESEND_API_KEY", "re_123");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "placeholder");

    expect(getResendEnv()?.appUrl).toBe("http://localhost:3000");
  });
});
