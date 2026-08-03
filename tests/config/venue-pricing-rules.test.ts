import { describe, it, expect } from "vitest";
import {
  getCourtCopFromRules,
  getPlayerFeeFromRules,
  RULE_BASED_VENUE_IDS,
} from "@/config/venue-pricing-rules";

// 2026-06-01 = Monday, 2026-06-06 = Saturday, 2026-06-07 = Sunday
const MONDAY = "2026-06-01";
const SATURDAY = "2026-06-06";
const SUNDAY = "2026-06-07";

describe("RULE_BASED_VENUE_IDS", () => {
  it("includes ace-padel-club and x3-padel-club", () => {
    expect(RULE_BASED_VENUE_IDS).toContain("ace-padel-club");
    expect(RULE_BASED_VENUE_IDS).toContain("x3-padel-club");
  });
});

// courtCop = cancha + $22,500 comisión. Player = courtCop / 4.
describe("getCourtCopFromRules — ace-padel-club", () => {
  describe("weekday 60min", () => {
    it("returns 72500 before 15:00 (cancha $50k + $22.5k)", () => {
      expect(getCourtCopFromRules("ace-padel-club", MONDAY, "10:00", 60)).toBe(72_500);
    });
    it("returns 132500 at peak (cancha $110k + $22.5k)", () => {
      expect(getCourtCopFromRules("ace-padel-club", MONDAY, "19:00", 60)).toBe(132_500);
    });
    it("returns null before opening on sunday", () => {
      expect(getCourtCopFromRules("ace-padel-club", SUNDAY, "06:00", 60)).toBeNull();
    });
  });
});

describe("getPlayerFeeFromRules", () => {
  it("returns courtCop / 4 (surcharge is 0)", () => {
    // courtCop 72_500 / 4 = 18_125
    expect(getPlayerFeeFromRules("ace-padel-club", MONDAY, "10:00", 60)).toBe(18_125);
  });

  it("returns null for time outside all ranges", () => {
    expect(getPlayerFeeFromRules("ace-padel-club", SUNDAY, "06:00", 60)).toBeNull();
  });
});

describe("getCourtCopFromRules — x3-padel-club", () => {
  it("returns 68500 weekday morning 60min (cancha $46k + $22.5k)", () => {
    expect(getCourtCopFromRules("x3-padel-club", MONDAY, "10:00", 60)).toBe(68_500);
  });
  it("returns null for unknown time slot (weekday 60min after 16:00)", () => {
    expect(getCourtCopFromRules("x3-padel-club", MONDAY, "17:00", 60)).toBeNull();
  });
});

describe("getCourtCopFromRules — la-jaula", () => {
  const FRIDAY = "2026-06-05";

  it("includes la-jaula in RULE_BASED_VENUE_IDS", () => {
    expect(RULE_BASED_VENUE_IDS).toContain("la-jaula");
  });

  describe("weekday (Mon-Thu) 90min", () => {
    it("returns 72500 at 05:00 (cancha $50k + $22.5k)", () => {
      expect(getCourtCopFromRules("la-jaula", MONDAY, "05:00", 90)).toBe(72_500);
    });
    it("returns 147500 at 19:00 (cancha $125k + $22.5k)", () => {
      expect(getCourtCopFromRules("la-jaula", MONDAY, "19:00", 90)).toBe(147_500);
    });
    it("returns null during midday gap (12:00)", () => {
      expect(getCourtCopFromRules("la-jaula", MONDAY, "12:00", 90)).toBeNull();
    });
  });

  describe("friday 90min", () => {
    it("returns 132500 at 20:30 (cancha $110k + $22.5k)", () => {
      expect(getCourtCopFromRules("la-jaula", FRIDAY, "20:30", 90)).toBe(132_500);
    });
  });

  describe("saturday 90min", () => {
    it("returns 103500 rest of day (cancha $81k + $22.5k)", () => {
      expect(getCourtCopFromRules("la-jaula", SATURDAY, "10:00", 90)).toBe(103_500);
    });
  });

  describe("player fee = (cancha + $22,500) / 4", () => {
    it("La Jaula 5am weekday 60min: (34k + 22.5k) / 4 = $14,125", () => {
      expect(getPlayerFeeFromRules("la-jaula", MONDAY, "05:00", 60)).toBe(14_125);
    });
    it("La Jaula saturday rest-of-day 90min: (81k + 22.5k) / 4 = $25,875", () => {
      expect(getPlayerFeeFromRules("la-jaula", SATURDAY, "10:00", 90)).toBe(25_875);
    });
  });
});

describe("friday fallback for venues without friday rules", () => {
  const FRIDAY = "2026-06-05";
  it("ace-padel-club uses weekday rules on Friday", () => {
    expect(getCourtCopFromRules("ace-padel-club", FRIDAY, "10:00", 60)).toBe(72_500);
  });
});

describe("getCourtCopFromRules — unknown venue", () => {
  it("returns null", () => {
    expect(getCourtCopFromRules("unknown-venue", MONDAY, "10:00", 60)).toBeNull();
  });
});
