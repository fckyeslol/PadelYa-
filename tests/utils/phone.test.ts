import { describe, it, expect } from "vitest";
import { normalizePhoneCO, localPhoneDigits, samePhone, digitsOnly } from "@/utils/phone";

describe("normalizePhoneCO", () => {
  it("normalizes a 10-digit local mobile to E.164", () => {
    expect(normalizePhoneCO("3001234567")).toBe("+573001234567");
  });

  it("normalizes a number that already has the +57 country code", () => {
    expect(normalizePhoneCO("+57 300 123 4567")).toBe("+573001234567");
  });

  it("normalizes a number with 57 prefix and no plus", () => {
    expect(normalizePhoneCO("573001234567")).toBe("+573001234567");
  });

  it("strips spaces, dashes and parentheses", () => {
    expect(normalizePhoneCO("(300) 123-4567")).toBe("+573001234567");
  });

  it("returns null when there are fewer than 10 digits", () => {
    expect(normalizePhoneCO("12345")).toBeNull();
  });

  it("returns null for empty or nullish input", () => {
    expect(normalizePhoneCO("")).toBeNull();
    expect(normalizePhoneCO(null)).toBeNull();
    expect(normalizePhoneCO(undefined)).toBeNull();
  });
});

describe("localPhoneDigits", () => {
  it("returns the last 10 digits", () => {
    expect(localPhoneDigits("+573001234567")).toBe("3001234567");
    expect(localPhoneDigits("3001234567")).toBe("3001234567");
  });

  it("returns empty string when too short", () => {
    expect(localPhoneDigits("123")).toBe("");
  });
});

describe("digitsOnly", () => {
  it("keeps only digits", () => {
    expect(digitsOnly("+57 (300) 123-4567")).toBe("573001234567");
  });
});

describe("samePhone", () => {
  it("matches across different formats of the same number", () => {
    expect(samePhone("+573001234567", "300 123 4567")).toBe(true);
    expect(samePhone("573001234567", "3001234567")).toBe(true);
  });

  it("does not match different numbers", () => {
    expect(samePhone("3001234567", "3009998877")).toBe(false);
  });

  it("never matches when a side is empty/invalid", () => {
    expect(samePhone("", "3001234567")).toBe(false);
    expect(samePhone(null, null)).toBe(false);
  });
});
