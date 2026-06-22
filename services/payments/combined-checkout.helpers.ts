/**
 * Pure helpers for the combined checkout (own slot + guest slots paid in one
 * Wompi transaction). Kept side-effect-free so the business rules (INV-1..INV-4
 * in docs/specs/jugadores-invitados.md) are unit-testable without a DB.
 */
import { normalizePhoneCO, samePhone } from "@/utils/phone";

export type RawGuest = { name: string; phone: string };
export type NormalizedGuest = { name: string; phone: string };

/** Number of slots a checkout funds: optional own slot + N guests. */
export function computeSlotCount(includeSelf: boolean, guestCount: number): number {
  return (includeSelf ? 1 : 0) + guestCount;
}

/** Total amount in COP = slots × per-player fee. */
export function computeCheckoutAmountCop(
  orgFeeCop: number,
  includeSelf: boolean,
  guestCount: number,
): number {
  return orgFeeCop * computeSlotCount(includeSelf, guestCount);
}

/**
 * Normalizes guest phones to E.164, trims names, and rejects duplicates within
 * the same request. Throws a user-facing Error on invalid/duplicate input.
 */
export function prepareGuests(guests: RawGuest[]): NormalizedGuest[] {
  const out: NormalizedGuest[] = [];
  const seen = new Set<string>();

  for (const guest of guests) {
    const name = guest.name.trim();
    if (name.length < 2) {
      throw new Error("El nombre del invitado es muy corto.");
    }
    const phone = normalizePhoneCO(guest.phone);
    if (!phone) {
      throw new Error(`El teléfono de "${name}" no es válido. Usa un celular colombiano.`);
    }
    if (seen.has(phone)) {
      throw new Error(`Agregaste a "${name}" dos veces (mismo teléfono).`);
    }
    seen.add(phone);
    out.push({ name, phone });
  }

  return out;
}

/**
 * INV-1 — who may add guests:
 *  (a) a player already paid in the match,
 *  (b) anyone including their own slot in this checkout,
 *  (c) the host of the match (player or organizer).
 * Throws when none holds.
 */
export function assertInviteAuthorized(params: {
  includeSelf: boolean;
  isAlreadyPaid: boolean;
  isHost: boolean;
  hasGuests: boolean;
}): void {
  if (!params.hasGuests) return; // paying only your own slot needs no authorization
  if (params.includeSelf || params.isAlreadyPaid || params.isHost) return;
  throw new Error("Primero debes unirte y pagar tu cupo para invitar a alguien.");
}

/**
 * INV-2 — capacity. `activeCount` is current paid+pending slots; `brandNewCount`
 * is how many NEW slots this checkout adds (reused slots excluded).
 */
export function assertCapacity(params: {
  maxPlayers: number;
  activeCount: number;
  brandNewCount: number;
}): void {
  const available = params.maxPlayers - params.activeCount;
  if (params.brandNewCount > available) {
    if (available <= 0) {
      throw new Error("Este partido ya está completo.");
    }
    throw new Error(
      available === 1
        ? "Solo queda 1 cupo disponible."
        : `Solo quedan ${available} cupos disponibles.`,
    );
  }
}

/**
 * INV-4 — a guest phone must not collide with a registered player already in
 * the match. Throws on the first collision.
 */
export function assertGuestsNotRegisteredPlayers(
  guests: NormalizedGuest[],
  registeredPlayerPhones: (string | null | undefined)[],
): void {
  for (const guest of guests) {
    if (registeredPlayerPhones.some((p) => samePhone(p, guest.phone))) {
      throw new Error(`"${guest.name}" ya está registrado en PadelYa y en este partido.`);
    }
  }
}
