import { describe, expect, it } from "vitest";
import {
  courtPriceAt,
  durationsFromRules,
  findOverlaps,
  isWithinHours,
  playerFeeAt,
  rulesForDay,
  validateRule,
  type VenueHours,
  type VenuePriceRule,
} from "@/services/pricing/venue-rules.helpers";
import { COURT_MARKUP_COP } from "@/config/venue-pricing-rules";

function rule(over: Partial<VenuePriceRule> = {}): VenuePriceRule {
  return {
    dayType: "weekday",
    durationMinutes: 90,
    startTime: "08:00",
    endTime: "12:00",
    courtPriceCop: 60_000,
    ...over,
  };
}

describe("rulesForDay", () => {
  it("devuelve las franjas del día pedido", () => {
    const rules = [rule({ dayType: "weekday" }), rule({ dayType: "saturday" })];
    expect(rulesForDay(rules, "saturday")).toHaveLength(1);
    expect(rulesForDay(rules, "saturday")[0].dayType).toBe("saturday");
  });

  it("cae a lunes-a-jueves cuando la sede no cargó viernes", () => {
    const rules = [rule({ dayType: "weekday", courtPriceCop: 55_000 })];
    const friday = rulesForDay(rules, "friday");
    expect(friday).toHaveLength(1);
    expect(friday[0].courtPriceCop).toBe(55_000);
  });

  it("prefiere las franjas de viernes cuando existen", () => {
    const rules = [
      rule({ dayType: "weekday", courtPriceCop: 55_000 }),
      rule({ dayType: "friday", courtPriceCop: 90_000 }),
    ];
    expect(rulesForDay(rules, "friday")[0].courtPriceCop).toBe(90_000);
  });

  it("NO cae a weekday para sábado ni domingo", () => {
    const rules = [rule({ dayType: "weekday" })];
    expect(rulesForDay(rules, "saturday")).toEqual([]);
    expect(rulesForDay(rules, "sunday")).toEqual([]);
  });
});

describe("courtPriceAt", () => {
  const rules = [
    rule({ startTime: "06:00", endTime: "12:00", courtPriceCop: 50_000 }),
    rule({ startTime: "17:00", endTime: "22:00", courtPriceCop: 110_000 }),
  ];

  it("encuentra el precio dentro de la franja", () => {
    expect(courtPriceAt(rules, "weekday", "08:00", 90)).toBe(50_000);
    expect(courtPriceAt(rules, "weekday", "18:30", 90)).toBe(110_000);
  });

  it("incluye el inicio y excluye el fin de la franja", () => {
    expect(courtPriceAt(rules, "weekday", "06:00", 90)).toBe(50_000);
    expect(courtPriceAt(rules, "weekday", "12:00", 90)).toBeNull();
  });

  it("devuelve null en un hueco sin tarifa", () => {
    expect(courtPriceAt(rules, "weekday", "14:00", 90)).toBeNull();
  });

  it("no cruza duraciones", () => {
    expect(courtPriceAt(rules, "weekday", "08:00", 60)).toBeNull();
  });
});

describe("playerFeeAt", () => {
  it("suma la comisión y divide entre los 4 jugadores", () => {
    const rules = [rule({ courtPriceCop: 50_000 })];
    const esperado = Math.round((50_000 + COURT_MARKUP_COP) / 4);
    expect(playerFeeAt(rules, "weekday", "09:00", 90)).toBe(esperado);
    expect(esperado).toBe(18_125);
  });

  it("devuelve null cuando no hay franja que cubra el horario", () => {
    expect(playerFeeAt([rule()], "weekday", "23:00", 90)).toBeNull();
  });
});

describe("durationsFromRules", () => {
  it("lista las duraciones tarifadas, ordenadas y sin repetir", () => {
    const rules = [
      rule({ durationMinutes: 120 }),
      rule({ durationMinutes: 60, startTime: "13:00", endTime: "14:00" }),
      rule({ durationMinutes: 60, startTime: "15:00", endTime: "16:00" }),
    ];
    expect(durationsFromRules(rules)).toEqual([60, 120]);
  });

  it("devuelve vacío cuando la sede no cargó nada", () => {
    expect(durationsFromRules([])).toEqual([]);
  });
});

describe("isWithinHours", () => {
  const hours: VenueHours = {
    dayType: "weekday",
    opensAt: "06:00",
    closesAt: "22:00",
    isClosed: false,
  };

  it("acepta un horario dentro de la apertura", () => {
    expect(isWithinHours(hours, "10:00")).toBe(true);
  });

  it("incluye la hora de apertura y excluye la de cierre", () => {
    expect(isWithinHours(hours, "06:00")).toBe(true);
    expect(isWithinHours(hours, "22:00")).toBe(false);
  });

  it("rechaza todo si el día está marcado como cerrado", () => {
    expect(isWithinHours({ ...hours, isClosed: true }, "10:00")).toBe(false);
  });

  it("no filtra cuando la sede no configuró horario", () => {
    expect(isWithinHours(null, "03:00")).toBe(true);
    expect(isWithinHours({ ...hours, opensAt: null, closesAt: null }, "03:00")).toBe(true);
  });
});

describe("findOverlaps", () => {
  it("detecta dos franjas que se pisan", () => {
    const a = rule({ startTime: "08:00", endTime: "12:00" });
    const b = rule({ startTime: "11:00", endTime: "14:00" });
    expect(findOverlaps([a, b])).toHaveLength(1);
  });

  it("no marca franjas que solo se tocan en el borde", () => {
    const a = rule({ startTime: "08:00", endTime: "12:00" });
    const b = rule({ startTime: "12:00", endTime: "14:00" });
    expect(findOverlaps([a, b])).toEqual([]);
  });

  it("ignora solapes entre distinto día o distinta duración", () => {
    const a = rule({ startTime: "08:00", endTime: "12:00", dayType: "weekday" });
    const b = rule({ startTime: "09:00", endTime: "11:00", dayType: "saturday" });
    const c = rule({ startTime: "09:00", endTime: "11:00", durationMinutes: 60 });
    expect(findOverlaps([a, b, c])).toEqual([]);
  });
});

describe("validateRule", () => {
  it("acepta una franja bien formada", () => {
    expect(validateRule(rule())).toBeNull();
  });

  it("rechaza que el fin sea anterior o igual al inicio", () => {
    expect(validateRule(rule({ startTime: "12:00", endTime: "12:00" }))).toMatch(/posterior/);
    expect(validateRule(rule({ startTime: "12:00", endTime: "10:00" }))).toMatch(/posterior/);
  });

  it("rechaza horas mal formadas", () => {
    expect(validateRule(rule({ startTime: "8:00" }))).toMatch(/HH:MM/);
  });

  it("rechaza precios no positivos o no enteros", () => {
    expect(validateRule(rule({ courtPriceCop: 0 }))).toMatch(/mayor a cero/);
    expect(validateRule(rule({ courtPriceCop: -5 }))).toMatch(/mayor a cero/);
    expect(validateRule(rule({ courtPriceCop: 1.5 }))).toMatch(/mayor a cero/);
  });

  it("rechaza un precio absurdamente alto (dedo pegado en el cero)", () => {
    expect(validateRule(rule({ courtPriceCop: 5_000_000 }))).toMatch(/2\.000\.000/);
  });
});
