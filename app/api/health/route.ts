import { getAppUrl } from "@/utils/auth-url";
import { getResendEnv, isSupabaseConfigured } from "@/utils/env";

export const dynamic = "force-dynamic";

/** Lightweight check for Vercel env setup (no secrets exposed). */
export async function GET() {
  const resend = getResendEnv();

  return Response.json({
    ok: isSupabaseConfigured(),
    supabasePublic: isSupabaseConfigured(),
    supabaseServiceRole: Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
        process.env.SUPABASE_SERVICE_ROLE_KEY !== "placeholder",
    ),
    appUrl: getAppUrl(),
    configuredAppUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
    appUrlNeedsUpdate:
      Boolean(process.env.NEXT_PUBLIC_APP_URL?.includes("padel-ya.vercel.app")) ||
      Boolean(process.env.NEXT_PUBLIC_APP_URL?.includes("localhost")),
    resendConfigured: Boolean(resend),
    resendFrom: resend?.from ?? null,
  });
}
