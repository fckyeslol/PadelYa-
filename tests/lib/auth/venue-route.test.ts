/**
 * `venueRouteError` es el único traductor de errores de todas las rutas del
 * portal. Importa que distinga bien los tres casos: sesión vencida tiene que dar
 * 401 (el front redirige al login con eso), y el resto 400. Si un error de
 * negocio saliera como 401, la sede vería "volvé a entrar" en vez del motivo.
 */
import { describe, it, expect } from "vitest";
import { z, ZodError } from "zod";
import { venueRouteError } from "@/lib/auth/venue-route";

async function leer(res: Response) {
  return { status: res.status, body: (await res.json()) as { error: string } };
}

describe("sesión vencida", () => {
  it("da 401 con un mensaje que le habla a la sede", async () => {
    const { status, body } = await leer(
      venueRouteError(new Error("Venue session required"), "fallback"),
    );

    expect(status).toBe(401);
    expect(body.error).toBe("Tu sesión venció. Volvé a entrar.");
  });

  it("no filtra el mensaje interno en inglés al cliente", async () => {
    const { body } = await leer(venueRouteError(new Error("Venue session required"), "fallback"));
    expect(body.error).not.toContain("Venue session");
  });
});

describe("body inválido (Zod)", () => {
  it("da 400 y nombra el campo que falló", async () => {
    const schema = z.object({ courtPriceCop: z.number().min(1) });
    let err: unknown;
    try {
      schema.parse({ courtPriceCop: 0 });
    } catch (e) {
      err = e;
    }

    const { status, body } = await leer(venueRouteError(err, "fallback"));
    expect(status).toBe(400);
    expect(body.error).toContain("courtPriceCop");
  });

  it("usa el path completo en campos anidados", async () => {
    const schema = z.object({ rules: z.array(z.object({ startTime: z.string().min(1) })) });
    let err: unknown;
    try {
      schema.parse({ rules: [{ startTime: "" }] });
    } catch (e) {
      err = e;
    }

    const { body } = await leer(venueRouteError(err, "fallback"));
    expect(body.error).toContain("rules.0.startTime");
  });

  it("cae a 'Datos inválidos.' si el ZodError no trae issues", async () => {
    const { status, body } = await leer(venueRouteError(new ZodError([]), "fallback"));
    expect(status).toBe(400);
    expect(body.error).toBe("Datos inválidos.");
  });
});

describe("errores de negocio", () => {
  it("da 400 y deja pasar el mensaje, que ya está escrito para una persona", async () => {
    const { status, body } = await leer(
      venueRouteError(new Error("Esa cancha ya tiene un partido a esa hora."), "fallback"),
    );

    expect(status).toBe(400);
    expect(body.error).toBe("Esa cancha ya tiene un partido a esa hora.");
  });

  it.each([
    ["un string suelto", "algo raro"],
    ["null", null],
    ["undefined", undefined],
    ["un número", 42],
    ["un objeto cualquiera", { code: "PGRST116" }],
  ])("usa el fallback cuando lo lanzado es %s", async (_caso, lanzado) => {
    const { status, body } = await leer(venueRouteError(lanzado, "No se pudo guardar."));

    expect(status).toBe(400);
    expect(body.error).toBe("No se pudo guardar.");
  });
});
