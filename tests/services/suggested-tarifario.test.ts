import { describe, expect, it } from "vitest";
import { buildSuggestedTarifario } from "@/services/venue-portal/pricing";
import {
  COURT_MARKUP_COP,
  getCourtCopFromRules,
  getRuleBandsForDay,
} from "@/config/venue-pricing-rules";
import { CASA_PADEL_COURT_COP } from "@/config/pricing";

describe("buildSuggestedTarifario", () => {
  it("sugiere franjas para una sede del tarifario estático", () => {
    const out = buildSuggestedTarifario("ace-padel-club");
    expect(Object.keys(out).length).toBeGreaterThan(0);
    expect(out["weekday:90"]?.length).toBeGreaterThan(0);
  });

  it("descuenta la comisión: el club ve su precio crudo, no el nuestro", () => {
    const bands = getRuleBandsForDay("ace-padel-club", "weekday", 90);
    const suggested = buildSuggestedTarifario("ace-padel-club")["weekday:90"];

    expect(suggested).toHaveLength(bands.length);
    for (let i = 0; i < bands.length; i++) {
      expect(suggested[i].courtPriceCop).toBe(bands[i].courtCop - COURT_MARKUP_COP);
      expect(suggested[i].startTime).toBe(bands[i].from);
      expect(suggested[i].endTime).toBe(bands[i].to);
    }
  });

  it("volver a sumar la comisión reproduce el courtCop de las reglas", () => {
    const suggested = buildSuggestedTarifario("la-jaula")["weekday:90"];
    expect(suggested.length).toBeGreaterThan(0);

    const band = suggested[0];
    const ruleCourtCop = getCourtCopFromRules("la-jaula", "2026-08-03", band.startTime, 90);
    expect(band.courtPriceCop + COURT_MARKUP_COP).toBe(ruleCourtCop);
  });

  it("cubre los 60 min de Padel Park, que antes solo existían en vivo", () => {
    const out = buildSuggestedTarifario("padel-park");
    expect(out["weekday:60"]?.length).toBeGreaterThan(0);
    expect(out["saturday:60"]?.length).toBeGreaterThan(0);
    expect(out["sunday:60"]?.length).toBeGreaterThan(0);
  });

  it("propone una franja única para Casa Padel, que no está en las reglas", () => {
    const out = buildSuggestedTarifario("casa-padel");
    const bands = out["weekday:90"];
    expect(bands).toHaveLength(1);
    expect(bands[0].courtPriceCop).toBe(CASA_PADEL_COURT_COP - COURT_MARKUP_COP);
  });

  it("nunca sugiere un precio que la validación rechazaría", () => {
    for (const venueId of ["ace-padel-club", "x3-padel-club", "la-jaula", "padel-park", "casa-padel"]) {
      for (const bands of Object.values(buildSuggestedTarifario(venueId))) {
        for (const b of bands) {
          expect(b.courtPriceCop).toBeGreaterThan(0);
          expect(Number.isInteger(b.courtPriceCop)).toBe(true);
          expect(b.endTime > b.startTime).toBe(true);
        }
      }
    }
  });

  it("devuelve un objeto vacío para una sede desconocida", () => {
    expect(buildSuggestedTarifario("sede-que-no-existe")).toEqual({});
  });
});
