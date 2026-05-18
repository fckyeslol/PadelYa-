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

export function getWompiEnv() {
  return {
    publicKey: required("NEXT_PUBLIC_WOMPI_PUBLIC_KEY", process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY),
    privateKey: required("WOMPI_PRIVATE_KEY", process.env.WOMPI_PRIVATE_KEY),
    webhookSecret: required("WOMPI_WEBHOOK_SECRET", process.env.WOMPI_WEBHOOK_SECRET),
    eventsUrl: process.env.WOMPI_EVENTS_URL ?? "https://production.wompi.co/v1/transactions",
  };
}

export function getResendEnv() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === "placeholder") {
    return null;
  }

  return {
    apiKey,
    from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
    appUrl: getAppUrl(),
  };
}
