/**
 * `sanitizeDisplayName` decide qué nombre se le muestra a los demás jugadores.
 * El caso que importa es el email: si alguien se registra y no completa nombre,
 * el fallback no puede ser mostrar su email entero en la lista del partido.
 */
import { describe, it, expect } from "vitest";
import { sanitizeDisplayName } from "@/utils/name";

describe("nombres normales", () => {
  it.each([
    ["mateo pirela", "Mateo Pirela"],
    ["MATEO PIRELA", "Mateo Pirela"],
    ["mAtEo", "Mateo"],
    ["  mateo  pirela  ", "Mateo Pirela"],
  ])("normaliza %o a %o", (entrada, esperado) => {
    expect(sanitizeDisplayName(entrada)).toBe(esperado);
  });

  it("conserva tildes y ñ", () => {
    expect(sanitizeDisplayName("josé muñoz")).toBe("José Muñoz");
  });

  it("conserva guiones y apóstrofes de apellidos compuestos", () => {
    expect(sanitizeDisplayName("ana maria d'angelo")).toBe("Ana Maria D'angelo");
  });

  it("saca símbolos sueltos", () => {
    expect(sanitizeDisplayName("mateo `pirela`")).toBe("Mateo Pirela");
  });
});

describe("emails: no se muestra el email", () => {
  it("separa el punto del local part", () => {
    expect(sanitizeDisplayName("mateo.pirela@gmail.com")).toBe("Mateo Pirela");
  });

  it.each([
    ["mateo_pirela@gmail.com", "Mateo Pirela"],
    ["mateo-pirela@gmail.com", "Mateo Pirela"],
    ["mateo.pirela.08@gmail.com", "Mateo Pirela"],
  ])("separa %o en %o", (entrada, esperado) => {
    expect(sanitizeDisplayName(entrada)).toBe(esperado);
  });

  it("nunca deja el arroba ni el dominio en el resultado", () => {
    for (const email of ["mateo.pirela@gmail.com", "x@y.co", "juanperez123@hotmail.com"]) {
      const salida = sanitizeDisplayName(email);
      expect(salida).not.toContain("@");
      expect(salida).not.toContain(".com");
    }
  });

  // Un local part pegado NO se parte, aunque el módulo tenga una lista de
  // nombres comunes con esa intención: la rama que la usa es inalcanzable.
  // Cuando el local part tiene letras, `separated` queda no vacío y la función
  // retorna antes; y cuando `separated` queda vacío (local part de sólo
  // dígitos o separadores), `lettersOnly` también queda vacío y cae al
  // fallback. O sea que COMMON_FIRST_NAMES nunca llega a usarse.
  // Se documenta el comportamiento real: cambiarlo alteraría los nombres que
  // ya ven los jugadores hoy, así que es una decisión de producto.
  it("no parte un local part pegado (COMMON_FIRST_NAMES es inalcanzable)", () => {
    expect(sanitizeDisplayName("mateopirela@gmail.com")).toBe("Mateopirela");
  });

  it("capitaliza el local part cuando no hay separadores", () => {
    expect(sanitizeDisplayName("zzxqwerty@gmail.com")).toBe("Zzxqwerty");
  });
});

describe("fallback", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["vacío", ""],
    ["sólo espacios", "   "],
    ["sólo el arroba", "@gmail.com"],
  ])("usa el fallback con %s", (_caso, entrada) => {
    expect(sanitizeDisplayName(entrada)).toBe("Jugador");
  });

  it("respeta un fallback propio", () => {
    expect(sanitizeDisplayName(null, "Invitado")).toBe("Invitado");
  });

  it("usa el fallback si el nombre era sólo símbolos", () => {
    expect(sanitizeDisplayName("!!!###")).toBe("Jugador");
  });

  it("usa el fallback si el local part queda sin letras", () => {
    expect(sanitizeDisplayName("12345@gmail.com")).toBe("Jugador");
  });
});
