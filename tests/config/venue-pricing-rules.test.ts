import { describe, it, expect } from "vitest";
import {
  getCourtCopFromRules,
  getPlayerFeeFromRules,
  PLAYER_FEE_SURCHARGE_COP,
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

describe("getCourtCopFromRules — ace-padel-club", () => {
  describe("weekday 60min", () => {
    it("returns 50000 before 15:00", () => {
      expect(getCourtCopFromRules("ace-padel-club", MONDAY, "10:00", 60)).toBe(50_000);
    });
    it("returns 84000 at 15:00", () => {
      expect(getCourtCopFromRules("ace-padel-club", MONDAY, "15:00", 60)).toBe(84_000);
    });
    it("returns 110000 at peak (17:00–21:30)", () => {
      expect(getCourtCopFromRules("ace-padel-club", MONDAY, "19:00", 60)).toBe(110_000);
    });
    it("returns 80000 after 21:30", () => {
      expect(getCourtCopFromRules("ace-padel-club", MONDAY, "22:00", 60)).toBe(80_000);
    });
  });

  describe("saturday 60min", () => {
    it("returns 60000 mid-day", () => {
      expect(getCourtCopFromRules("ace-padel-club", SATURDAY, "10:00", 60)).toBe(60_000);
    });
    it("returns 80000 evening", () => {
      expect(getCourtCopFromRules("ace-padel-club", SATURDAY, "18:00", 60)).toBe(80_000);
    });
  });

  describe("sunday 60min", () => {
    it("returns 60000 mid-day", () => {
      expect(getCourtCopFromRules("ace-padel-club", SUNDAY, "12:00", 60)).toBe(60_000);
    });
    it("returns null before opening (06:00)", () => {
      expect(getCourtCopFromRules("ace-padel-club", SUNDAY, "06:00", 60)).toBeNull();
    });
  });
});

describe("getPlayerFeeFromRules", () => {
  it("returns court / 4 plus the per-player platform surcharge", () => {
    // court 50_000 / 4 = 12_500, + surcharge
    expect(getPlayerFeeFromRules("ace-padel-club", MONDAY, "10:00", 60)).toBe(
      12_500 + PLAYER_FEE_SURCHARGE_COP,
    );
  });

  it("returns null for time outside all ranges", () => {
    expect(getPlayerFeeFromRules("ace-padel-club", SUNDAY, "06:00", 60)).toBeNull();
  });
});

describe("getCourtCopFromRules — x3-padel-club", () => {
  it("returns 46000 weekday morning 60min", () => {
    expect(getCourtCopFromRules("x3-padel-club", MONDAY, "10:00", 60)).toBe(46_000);
  });
  it("returns null for unknown time slot (weekday 60min after 16:00)", () => {
    // x3 weekday 60min only has from 05:30 to 16:00
    expect(getCourtCopFromRules("x3-padel-club", MONDAY, "17:00", 60)).toBeNull();
  });
});

describe("getCourtCopFromRules — la-jaula", () => {
  const FRIDAY = "2026-06-05";

  it("includes la-jaula in RULE_BASED_VENUE_IDS", () => {
    expect(RULE_BASED_VENUE_IDS).toContain("la-jaula");
  });

  describe("weekday (Mon-Thu) 90min", () => {
    it("returns 50000 at 05:00", () => {
      expect(getCourtCopFromRules("la-jaula", MONDAY, "05:00", 90)).toBe(50_000);
    });
    it("returns 60000 at 06:30", () => {
      expect(getCourtCopFromRules("la-jaula", MONDAY, "06:30", 90)).toBe(60_000);
    });
    it("returns 51000 at 15:00 (afternoon)", () => {
      expect(getCourtCopFromRules("la-jaula", MONDAY, "15:00", 90)).toBe(51_000);
    });
    it("returns 125000 at 19:00 (prime night)", () => {
      expect(getCourtCopFromRules("la-jaula", MONDAY, "19:00", 90)).toBe(125_000);
    });
    it("returns 88000 at 22:00 (late night)", () => {
      expect(getCourtCopFromRules("la-jaula", MONDAY, "22:00", 90)).toBe(88_000);
    });
    it("returns null during midday gap (12:00)", () => {
      expect(getCourtCopFromRules("la-jaula", MONDAY, "12:00", 90)).toBeNull();
    });
  });

  describe("friday 90min", () => {
    it("returns 125000 at 19:00", () => {
      expect(getCourtCopFromRules("la-jaula", FRIDAY, "19:00", 90)).toBe(125_000);
    });
    it("returns 110000 at 20:30 (cheaper than Mon-Thu)", () => {
      expect(getCourtCopFromRules("la-jaula", FRIDAY, "20:30", 90)).toBe(110_000);
    });
    it("returns 88000 at 22:00", () => {
      expect(getCourtCopFromRules("la-jaula", FRIDAY, "22:00", 90)).toBe(88_000);
    });
  });

  describe("saturday 90min", () => {
    it("returns 50000 in early morning", () => {
      expect(getCourtCopFromRules("la-jaula", SATURDAY, "06:00", 90)).toBe(50_000);
    });
    it("returns 81000 rest of day", () => {
      expect(getCourtCopFromRules("la-jaula", SATURDAY, "10:00", 90)).toBe(81_000);
    });
    it("returns 81000 in the evening", () => {
      expect(getCourtCopFromRules("la-jaula", SATURDAY, "19:00", 90)).toBe(81_000);
    });
  });

  describe("weekday 60min", () => {
    it("returns 34000 early morning", () => {
      expect(getCourtCopFromRules("la-jaula", MONDAY, "05:00", 60)).toBe(34_000);
    });
    it("returns 40000 at 06:30", () => {
      expect(getCourtCopFromRules("la-jaula", MONDAY, "07:00", 60)).toBe(40_000);
    });
  });

  describe("player fee includes surcharge", () => {
    it("saturday 90min rest-of-day: 81000/4 + 1500 = 21750", () => {
      expect(getPlayerFeeFromRules("la-jaula", SATURDAY, "10:00", 90)).toBe(
        Math.round(81_000 / 4) + PLAYER_FEE_SURCHARGE_COP,
      );
    });
  });
});

describe("friday fallback for venues without friday rules", () => {
  const FRIDAY = "2026-06-05";
  it("ace-padel-club uses weekday rules on Friday", () => {
    expect(getCourtCopFromRules("ace-padel-club", FRIDAY, "10:00", 60)).toBe(50_000);
  });
});

describe("getCourtCopFromRules — unknown venue", () => {
  it("returns null", () => {
    expect(getCourtCopFromRules("unknown-venue", MONDAY, "10:00", 60)).toBeNull();
  });
});
