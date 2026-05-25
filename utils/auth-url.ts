/** Canonical production domain (custom domain on Vercel). */
export const PRODUCTION_APP_URL = "https://padelya.co";

const DEPRECATED_APP_HOSTS = new Set(["padel-ya.vercel.app"]);

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

  return configured ? normalizeAppUrl(configured) : "http://localhost:3000";
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

/** Client-side callback URL for signInWithOtp. */
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
    return buildAuthCallbackUrl(origin, next);
  }

  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl && envUrl !== "placeholder" && !envUrl.includes("localhost")) {
    return buildAuthCallbackUrl(normalizeAppUrl(envUrl), next);
  }

  return buildAuthCallbackUrl(origin, next);
}
