/**
 * Formato de fechas de partidos. Todo se muestra en hora de Bogotá sin importar
 * dónde corra el servidor: si esto se escapara al UTC del contenedor, un partido
 * de las 19:00 se vería a medianoche.
 */
import { describe, it, expect } from "vitest";
import { formatDateTime, formatDateTimeRange } from "@/utils/dates";

// 2026-06-17 19:00 Bogotá (UTC-5) = 2026-06-18 00:00 UTC.
const LUNES_19H_BOGOTA = "2026-06-18T00:00:00.000Z";

describe("formatDateTime", () => {
  it("muestra la hora de Bogotá, no la del servidor", () => {
    const salida = formatDateTime(LUNES_19H_BOGOTA);
    expect(salida).toContain("7:00");
    expect(salida).toMatch(/p\.?\s?m\.?/i);
  });

  it("incluye la fecha", () => {
    expect(formatDateTime(LUNES_19H_BOGOTA)).toMatch(/17/);
  });

  it("usa 12 horas con am/pm, no 24", () => {
    const manana = formatDateTime("2026-06-17T13:00:00.000Z"); // 08:00 Bogotá
    expect(manana).toContain("8:00");
    expect(manana).toMatch(/a\.?\s?m\.?/i);
  });

  it("cruza bien el día: 23:00 UTC sigue siendo el 17 en Bogotá", () => {
    // 2026-06-17T23:00Z = 18:00 del 17 en Bogotá.
    expect(formatDateTime("2026-06-17T23:00:00.000Z")).toMatch(/17/);
  });
});

describe("formatDateTimeRange", () => {
  it.each([
    [60, "8:00"],
    [90, "8:30"],
    [120, "9:00"],
  ] as const)("con %i minutos termina a las %s", (duracion, finEsperado) => {
    const salida = formatDateTimeRange(LUNES_19H_BOGOTA, duracion);
    expect(salida).toContain("7:00");
    expect(salida).toContain(finEsperado);
  });

  it("separa inicio y fin con guion", () => {
    expect(formatDateTimeRange(LUNES_19H_BOGOTA, 90)).toContain(" - ");
  });

  it("la fecha aparece una sola vez, sólo del lado del inicio", () => {
    const salida = formatDateTimeRange(LUNES_19H_BOGOTA, 90);
    const [inicio, fin] = salida.split(" - ");

    expect(inicio).toMatch(/17/);
    // El fin es sólo la hora: repetir la fecha sería ruido.
    expect(fin).not.toMatch(/2026/);
  });

  it("un partido que cruza la medianoche muestra la hora del día siguiente", () => {
    // 23:30 Bogotá + 120 min = 01:30 del día siguiente.
    const salida = formatDateTimeRange("2026-06-18T04:30:00.000Z", 120);
    expect(salida).toContain("11:30");
    expect(salida).toContain("1:30");
  });
});
