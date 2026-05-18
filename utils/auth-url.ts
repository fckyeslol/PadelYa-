/** Public site URL for auth redirects (never localhost in production when Vercel is set). */
export function getAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (configured && configured !== "placeholder" && !configured.includes("localhost")) {
    return configured;
  }

  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (vercelHost) {
    return vercelHost.startsWith("http") ? vercelHost.replace(/\/$/, "") : `https://${vercelHost}`;
  }

  return configured || "http://localhost:3000";
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
  if (trimmed && isAllowedAuthOrigin(trimmed)) {
    return trimmed;
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
/** Supabase may embed Site URL in action_link; force our production callback. */
export function normalizeSupabaseActionLink(actionLink: string, redirectTo: string): string {
  try {
    const url = new URL(actionLink);
    if (url.searchParams.has("redirect_to")) {
      url.searchParams.set("redirect_to", redirectTo);
    }
    return url.toString();
  } catch {
    return actionLink;
  }
}

export function getClientAuthCallbackUrl(next?: string): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const { origin, hostname } = window.location;
  if (hostname !== "localhost" && hostname !== "127.0.0.1") {
    return buildAuthCallbackUrl(origin, next);
  }

  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (envUrl && envUrl !== "placeholder" && !envUrl.includes("localhost")) {
    return buildAuthCallbackUrl(envUrl, next);
  }

  return buildAuthCallbackUrl(origin, next);
}
