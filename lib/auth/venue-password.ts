import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LEN = 64;

export function hashVenuePassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, KEY_LEN);
  return `${salt.toString("base64")}:${key.toString("base64")}`;
}

export function verifyVenuePassword(password: string, stored: string): boolean {
  const [saltB64, keyB64] = stored.split(":");
  if (!saltB64 || !keyB64) return false;
  try {
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(keyB64, "base64");
    const actual = scryptSync(password, salt, expected.length);
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
