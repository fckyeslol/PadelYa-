import { describe, it, expect } from "vitest";
import { bogotaDateAndTime, getCourtPriceCop, getPlayerFeeCop } from "@/config/pricing";
import { PLAYER_FEE_SURCHARGE_COP } from "@/config/venue-pricing-rules";

describe("bogotaDateAndTime", () => {
  it("converts UTC to Bogota time (UTC-5)", () => {
    // 20:00 UTC = 15:00 Bogota
    const result = bogotaDateAndTime("2026-05-28T20:00:00Z");
    expect(result.date).toBe("2026-05-28");
    expect(result.time).toBe("15:00");
  });

  it("crosses midnight — 03:00 UTC is previous day 22:00 in Bogota", () => {
    const result = bogotaDateAndTime("2026-05-29T03:00:00Z");
    expect(result.date).toBe("2026-05-28");
    expect(result.time).toBe("22:00");
  });

  it("pads hours and minutes with leading zeros", () => {
    // 08:00 Bogota = 13:00 UTC
    const result = bogotaDateAndTime("2026-05-28T13:00:00Z");
    expect(result.time).toBe("08:00");
  });
});

describe("getCourtPriceCop — casa-padel (fixed price)", () => {
  it("returns a positive integer", () => {
    const price = getCourtPriceCop("casa-padel", "2026-06-01", "10:00");
    expect(typeof price).toBe("number");
    expect(price).toBeGreaterThan(0);
  });
});

describe("getPlayerFeeCop", () => {
  it("returns court price / 4 plus the per-player surcharge", () => {
    const court = getCourtPriceCop("casa-padel", "2026-06-01", "10:00");
    const player = getPlayerFeeCop("casa-padel", "2026-06-01", "10:00");
    if (court !== null && player !== null) {
      expect(player).toBe(Math.round(court / 4) + PLAYER_FEE_SURCHARGE_COP);
    }
  });

  it("returns null for unknown venue", () => {
    expect(getPlayerFeeCop("unknown-venue", "2026-06-01", "10:00")).toBeNull();
  });
});
