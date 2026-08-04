/**
 * `getErrorMessage` es la defensa contra la lección #2 del proyecto: los errores
 * de PostgREST son objetos planos, no instancias de Error, así que un
 * `error.message` directo o un `instanceof Error` los deja sin mensaje y termina
 * mostrando algo genérico que oculta la causa real.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { getErrorMessage } from "@/utils/errors";

describe("Error normal", () => {
  it("usa el message", () => {
    expect(getErrorMessage(new Error("algo explotó"))).toBe("algo explotó");
  });

  it("funciona con subclases", () => {
    class MiError extends Error {}
    expect(getErrorMessage(new MiError("subclase"))).toBe("subclase");
  });

  // Comportamiento actual: un Error con message vacío devuelve "" en vez del
  // fallback, porque la rama de `instanceof Error` retorna el message sin
  // mirar si tiene contenido. Se documenta tal cual; cambiarlo es una decisión
  // de producto (mostraría el fallback donde hoy se ve vacío).
  it("un Error con message vacío devuelve vacío, no el fallback", () => {
    expect(getErrorMessage(new Error(""), "fallback")).toBe("");
  });
});

describe("ZodError", () => {
  it("usa el mensaje del primer issue, no el JSON entero", () => {
    const schema = z.object({ phone: z.string().min(10, "El teléfono es muy corto") });
    let err: unknown;
    try {
      schema.parse({ phone: "123" });
    } catch (e) {
      err = e;
    }

    expect(getErrorMessage(err)).toBe("El teléfono es muy corto");
  });
});

describe("objetos tipo PostgREST", () => {
  it("saca el message de un objeto plano", () => {
    // Forma real de un error de PostgREST: objeto, no Error.
    const postgrest = { code: "23505", details: null, hint: null, message: "duplicate key value" };
    expect(getErrorMessage(postgrest)).toBe("duplicate key value");
  });

  it("ignora un message que no es string", () => {
    expect(getErrorMessage({ message: 500 }, "fallback")).toBe("fallback");
  });

  it("ignora un message en blanco", () => {
    expect(getErrorMessage({ message: "   " }, "fallback")).toBe("fallback");
  });
});

describe("strings sueltos", () => {
  it("usa el string tal cual", () => {
    expect(getErrorMessage("se cayó la red")).toBe("se cayó la red");
  });

  it("cae al fallback si es sólo espacios", () => {
    expect(getErrorMessage("   ", "fallback")).toBe("fallback");
  });
});

describe("valores sin mensaje aprovechable", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["un número", 500],
    ["un objeto vacío", {}],
    ["un array", []],
    ["false", false],
  ])("cae al fallback con %s", (_caso, valor) => {
    expect(getErrorMessage(valor, "fallback")).toBe("fallback");
  });

  it("tiene un fallback por defecto en español", () => {
    expect(getErrorMessage(null)).toBe("Ocurrió un error inesperado");
  });
});
