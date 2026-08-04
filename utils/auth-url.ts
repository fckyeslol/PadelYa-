/**
 * Canonical production domain (custom domain on Vercel).
 * MUST match Vercel's primary domain: the apex `padelya.co` 307-redirects to
 * `www.padelya.co`, so auth must emit www URLs — otherwise the session cookie
 * is set on apex and then dropped when the browser bounces to www (host-only
 * cookies), leaving the user logged-out. Keep this aligned with the SEO
 * canonical in app/layout.tsx and the Supabase redirect allowlist.
 */
export const PRODUCTION_APP_URL = "https://www.padelya.co";

// Hosts that should be rewritten to the canonical production URL.
// Includes deprecated Vercel preview URLs and the bare apex (which redirects to www).
const DEPRECATED_APP_HOSTS = new Set(["padel-ya.vercel.app", "padelya.co"]);

function stripTrailingSlash(url: string) {
  return url.replace(/\/$/, "");
}

/** Rewrites dead preview URLs to the live custom domain. */
export function normalizeAppUrl(url: string): string {
  const trimmed = stripTrailingSlash(url);
  try {
    const { hostname } = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    if (DEPRECATED_APP_HOSTS.has(hostname)) {
      return PRODUCTION_APP_URL;
    }
  } catch {
    // keep trimmed
  }
  return trimmed;
}

/** Public site URL for auth redirects (never localhost in production when Vercel is set). */
export function getAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured && configured !== "placeholder" && !configured.includes("localhost")) {
    return normalizeAppUrl(configured);
  }

  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (vercelHost) {
    const raw = vercelHost.startsWith("http") ? vercelHost : `https://${vercelHost}`;
    const normalized = normalizeAppUrl(stripTrailingSlash(raw));
    if (!normalized.includes("localhost")) {
      return normalized;
    }
  }

  if (process.env.VERCEL === "1") {
    return PRODUCTION_APP_URL;
  }

  // El chequeo de "placeholder" se repite acá a propósito: sin él, este último
  // fallback devolvía el literal "placeholder" (es truthy), y de ahí salían URLs
  // como `placeholder/matches/<id>` en el redirect de pago de Wompi y en los
  // links de los mails. El resto del repo trata "placeholder" como "sin
  // configurar" (utils/env.ts); esta rama se lo había salteado.
  const usable = configured && configured !== "placeholder" ? configured : null;
  return usable ? normalizeAppUrl(usable) : "http://localhost:3000";
}

export function isAllowedAuthOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    const host = url.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return true;
    }
    if (host.endsWith(".vercel.app")) {
      return true;
    }

    if (host === "padelya.co" || host === "www.padelya.co") {
      return true;
    }

    try {
      const appHost = new URL(getAppUrl()).hostname;
      if (host === appHost) {
        return true;
      }
    } catch {
      // ignore
    }

    return false;
  } catch {
    return false;
  }
}

/** Prefer the live browser origin on production; env/Vercel on the server. */
export function resolveAuthRedirectOrigin(requestOrigin?: string): string {
  const trimmed = requestOrigin?.trim().replace(/\/$/, "");
  if (trimmed) {
    const normalized = normalizeAppUrl(trimmed);
    if (isAllowedAuthOrigin(normalized)) {
      return normalized;
    }
  }
  return getAppUrl();
}

export function buildAuthCallbackUrl(origin: string, next?: string): string {
  const base = origin.replace(/\/$/, "");
  const path = "/auth/callback";
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return `${base}${path}?next=${encodeURIComponent(next)}`;
  }
  return `${base}${path}`;
}

/** Direct app link using hashed_token (avoids broken redirect_to / localhost). */
export function buildMagicLinkFromHashedToken(
  callbackUrl: string,
  hashedToken: string,
  type: "magiclink" | "signup" = "magiclink",
): string {
  const url = new URL(callbackUrl);
  url.searchParams.set("token_hash", hashedToken);
  url.searchParams.set("type", type);
  return url.toString();
}

export function getClientAuthCallbackUrl(next?: string): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const { origin, hostname } = window.location;
  if (hostname !== "localhost" && hostname !== "127.0.0.1") {
    // Always normalize to canonical domain so www.padelya.co → padelya.co.
    // This prevents Supabase from rejecting the redirectTo when the user
    // arrives via the www subdomain (which may not be in the allowlist).
    const canonicalOrigin = normalizeAppUrl(origin);
    return buildAuthCallbackUrl(canonicalOrigin, next);
  }

  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl && envUrl !== "placeholder" && !envUrl.includes("localhost")) {
    return buildAuthCallbackUrl(normalizeAppUrl(envUrl), next);
  }

  return buildAuthCallbackUrl(origin, next);
}
