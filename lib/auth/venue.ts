import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "venue_session";
const SESSION_DAYS = 14;

export type VenueSession = {
  accountId: string;
  venueId: string;
  username: string;
  venueName: string;
  exp: number;
};

function getSessionSecret(): string {
  const secret = process.env.VENUE_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing required env var: VENUE_SESSION_SECRET (min 32 chars)");
    }
    return "dev-venue-session-secret-min-32-chars!!";
  }
  return secret;
}

function sign(payloadB64: string): string {
  return createHmac("sha256", getSessionSecret()).update(payloadB64).digest("base64url");
}

function encodeSession(session: VenueSession): string {
  const payloadB64 = Buffer.from(JSON.stringify(session)).toString("base64url");
  const sig = sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

function decodeSession(token: string): VenueSession | null {
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;
  const expected = sign(payloadB64);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const session = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as VenueSession;
    if (!session.accountId || !session.venueId || !session.exp) return null;
    if (Date.now() > session.exp) return null;
    return session;
  } catch {
    return null;
  }
}

export async function getVenueSession(): Promise<VenueSession | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  return decodeSession(raw);
}

export async function requireVenueSession(): Promise<VenueSession> {
  const session = await getVenueSession();
  if (!session) {
    throw new Error("Venue session required");
  }
  return session;
}

export async function setVenueSessionCookie(session: Omit<VenueSession, "exp">): Promise<void> {
  const jar = await cookies();
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const full: VenueSession = { ...session, exp };
  jar.set(COOKIE_NAME, encodeSession(full), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearVenueSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export { COOKIE_NAME };
