import { describe, it, expect } from "vitest";
import {
  computeSlotCount,
  computeCheckoutAmountCop,
  prepareGuests,
  assertInviteAuthorized,
  assertCapacity,
  assertGuestsNotRegisteredPlayers,
} from "@/services/payments/combined-checkout.helpers";

describe("computeSlotCount / computeCheckoutAmountCop", () => {
  it("counts own slot plus guests", () => {
    expect(computeSlotCount(true, 2)).toBe(3);
    expect(computeSlotCount(false, 2)).toBe(2);
    expect(computeSlotCount(true, 0)).toBe(1);
  });

  it("multiplies the fee by the slot count", () => {
    expect(computeCheckoutAmountCop(25000, true, 2)).toBe(75000);
    expect(computeCheckoutAmountCop(25000, false, 2)).toBe(50000);
    expect(computeCheckoutAmountCop(25000, true, 0)).toBe(25000);
  });
});

describe("prepareGuests", () => {
  it("normalizes phones and trims names", () => {
    const result = prepareGuests([{ name: "  Carlos  ", phone: "300 123 4567" }]);
    expect(result).toEqual([{ name: "Carlos", phone: "+573001234567" }]);
  });

  it("rejects a too-short name", () => {
    expect(() => prepareGuests([{ name: "C", phone: "3001234567" }])).toThrow(/nombre/i);
  });

  it("rejects an invalid phone", () => {
    expect(() => prepareGuests([{ name: "Carlos", phone: "123" }])).toThrow(/teléfono/i);
  });

  it("rejects duplicate phones in the same request", () => {
    expect(() =>
      prepareGuests([
        { name: "Carlos", phone: "3001234567" },
        { name: "Carlitos", phone: "+57 300 123 4567" },
      ]),
    ).toThrow(/dos veces/i);
  });
});

describe("assertInviteAuthorized (INV-1)", () => {
  it("allows paying only your own slot with no guests", () => {
    expect(() =>
      assertInviteAuthorized({ includeSelf: true, isAlreadyPaid: false, isHost: false, hasGuests: false }),
    ).not.toThrow();
  });

  it("allows an already-paid player to invite", () => {
    expect(() =>
      assertInviteAuthorized({ includeSelf: false, isAlreadyPaid: true, isHost: false, hasGuests: true }),
    ).not.toThrow();
  });

  it("allows the host to invite without occupying a slot", () => {
    expect(() =>
      assertInviteAuthorized({ includeSelf: false, isAlreadyPaid: false, isHost: true, hasGuests: true }),
    ).not.toThrow();
  });

  it("allows including own slot together with guests", () => {
    expect(() =>
      assertInviteAuthorized({ includeSelf: true, isAlreadyPaid: false, isHost: false, hasGuests: true }),
    ).not.toThrow();
  });

  it("rejects a non-paid non-host inviting without paying their own slot", () => {
    expect(() =>
      assertInviteAuthorized({ includeSelf: false, isAlreadyPaid: false, isHost: false, hasGuests: true }),
    ).toThrow(/primero debes/i);
  });
});

describe("assertCapacity (INV-2)", () => {
  it("allows when new slots fit", () => {
    expect(() => assertCapacity({ maxPlayers: 4, activeCount: 1, brandNewCount: 3 })).not.toThrow();
  });

  it("rejects when new slots exceed available, naming the remaining count", () => {
    expect(() => assertCapacity({ maxPlayers: 4, activeCount: 3, brandNewCount: 2 })).toThrow(
      /1 cupo disponible/i,
    );
  });

  it("rejects when the match is already complete", () => {
    expect(() => assertCapacity({ maxPlayers: 4, activeCount: 4, brandNewCount: 1 })).toThrow(
      /completo/i,
    );
  });
});

describe("assertGuestsNotRegisteredPlayers (INV-4)", () => {
  it("rejects a guest whose phone matches a registered player in the match", () => {
    expect(() =>
      assertGuestsNotRegisteredPlayers(
        [{ name: "Carlos", phone: "+573001234567" }],
        ["300 123 4567"],
      ),
    ).toThrow(/ya está registrado/i);
  });

  it("allows guests that do not collide", () => {
    expect(() =>
      assertGuestsNotRegisteredPlayers(
        [{ name: "Carlos", phone: "+573001234567" }],
        ["+573009998877", null],
      ),
    ).not.toThrow();
  });
});
