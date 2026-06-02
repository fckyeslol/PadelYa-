import { getAppUrl } from "@/utils/auth-url";

function required(name: string, value: string | undefined): string {
  if (!value || value === "placeholder") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function isConfigured(value: string | undefined): value is string {
  return Boolean(value && value !== "placeholder");
}

/** True when Supabase public env vars are set (e.g. on Vercel). */
export function isSupabaseConfigured(): boolean {
  return (
    isConfigured(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    isConfigured(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

export function getPublicSupabaseEnv() {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  };
}

/** Public key for the Wompi Widget (safe to expose in the browser). */
export function getWompiPublicKey() {
  return required("NEXT_PUBLIC_WOMPI_PUBLIC_KEY", process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY);
}

/** Server-only: generates the integrity hash for Wompi payment requests. */
export function getWompiIntegritySecret() {
  return required("WOMPI_INTEGRITY_SECRET", process.env.WOMPI_INTEGRITY_SECRET);
}

/** Server-only: validates Wompi webhook event signatures. */
export function getWompiEventsSecret() {
  return required("WOMPI_WEBHOOK_SECRET", process.env.WOMPI_WEBHOOK_SECRET);
}

export function getUltraMsgEnv() {
  const instance = process.env.ULTRAMSG_INSTANCE;
  const token = process.env.ULTRAMSG_TOKEN;
  if (!instance || !token) return null;
  return { instance, token };
}

export function getResendEnv() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === "placeholder") {
    return null;
  }

  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || "PadelYa <noreply@padelya.co>";

  return {
    apiKey,
    from,
    appUrl: getAppUrl(),
  };
}
