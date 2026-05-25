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

/** Server-only: creates preferences and processes payments. */
export function getMercadoPagoAccessToken() {
  return required("MP_ACCESS_TOKEN", process.env.MP_ACCESS_TOKEN);
}

/** Public key for Payment Brick (safe to expose in the browser). */
export function getMercadoPagoPublicKey() {
  return required("NEXT_PUBLIC_MP_PUBLIC_KEY", process.env.NEXT_PUBLIC_MP_PUBLIC_KEY);
}

/** Server-only: validates Mercado Pago webhook signatures. */
export function getMercadoPagoWebhookSecret() {
  return required("MP_WEBHOOK_SECRET", process.env.MP_WEBHOOK_SECRET);
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
