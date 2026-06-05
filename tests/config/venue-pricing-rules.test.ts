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

describe("getCourtCopFromRules — unknown venue", () => {
  it("returns null", () => {
    expect(getCourtCopFromRules("unknown-venue", MONDAY, "10:00", 60)).toBeNull();
  });
});
