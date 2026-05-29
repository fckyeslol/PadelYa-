import { describe, it, expect } from "vitest";
import { hashVenuePassword, verifyVenuePassword } from "@/lib/auth/venue-password";

describe("hashVenuePassword / verifyVenuePassword", () => {
  it("verifies a correct password against its hash", () => {
    const hash = hashVenuePassword("secret123");
    expect(verifyVenuePassword("secret123", hash)).toBe(true);
  });

  it("rejects a wrong password", () => {
    const hash = hashVenuePassword("secret123");
    expect(verifyVenuePassword("wrong", hash)).toBe(false);
  });

  it("generates different hashes for the same password (random salt)", () => {
    const h1 = hashVenuePassword("secret");
    const h2 = hashVenuePassword("secret");
    expect(h1).not.toBe(h2);
    // But both must still verify correctly
    expect(verifyVenuePassword("secret", h1)).toBe(true);
    expect(verifyVenuePassword("secret", h2)).toBe(true);
  });

  it("rejects malformed stored hash", () => {
    expect(verifyVenuePassword("password", "invaliddatawithnocolon")).toBe(false);
  });

  it("rejects empty stored hash", () => {
    expect(verifyVenuePassword("password", "")).toBe(false);
  });

  it("is case-sensitive", () => {
    const hash = hashVenuePassword("Secret");
    expect(verifyVenuePassword("secret", hash)).toBe(false);
  });
});
