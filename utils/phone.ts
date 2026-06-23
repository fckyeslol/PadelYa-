/**
 * Colombian phone normalization for guest players.
 *
 * Mobiles in Colombia are 10 digits starting with 3; the country code is 57.
 * Guests are stored in E.164 (+57XXXXXXXXXX) so they can be matched later when
 * the guest registers (claim flow) and messaged via WhatsApp.
 */

const CO_COUNTRY_CODE = "57";
const LOCAL_LENGTH = 10;

/** Strips everything except digits. */
export function digitsOnly(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

/**
 * Returns the 10-digit local Colombian number used for matching, or "" when it
 * cannot be derived. Always compares the last 10 digits so "+57 300…",
 * "57300…" and "300…" all collapse to the same value.
 */
export function localPhoneDigits(raw: string | null | undefined): string {
  const digits = digitsOnly(raw);
  if (digits.length < LOCAL_LENGTH) return "";
  return digits.slice(-LOCAL_LENGTH);
}

/**
 * Normalizes a user-typed phone to E.164 for Colombia (+57XXXXXXXXXX).
 * Returns null when the input does not contain a usable 10-digit local number.
 */
export function normalizePhoneCO(raw: string | null | undefined): string | null {
  const local = localPhoneDigits(raw);
  if (local.length !== LOCAL_LENGTH) return null;
  return `+${CO_COUNTRY_CODE}${local}`;
}

/** True when both phones resolve to the same Colombian local number. */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const la = localPhoneDigits(a);
  const lb = localPhoneDigits(b);
  return la !== "" && la === lb;
}
