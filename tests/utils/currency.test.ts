import { describe, it, expect } from "vitest";
import { formatCop } from "@/utils/currency";

describe("formatCop", () => {
  it("formats zero", () => expect(formatCop(0)).toBe("$ 0"));
  it("formats three digits", () => expect(formatCop(500)).toBe("$ 500"));
  it("formats thousands with dot separator", () => expect(formatCop(50_000)).toBe("$ 50.000"));
  it("formats millions", () => expect(formatCop(1_000_000)).toBe("$ 1.000.000"));
  it("rounds fractional values", () => expect(formatCop(50_000.7)).toBe("$ 50.001"));
  it("treats negative values as positive", () => expect(formatCop(-1_000)).toBe("$ 1.000"));
  it("formats typical player fee", () => expect(formatCop(27_500)).toBe("$ 27.500"));
});
