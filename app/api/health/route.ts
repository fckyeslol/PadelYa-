import { isSupabaseConfigured } from "@/utils/env";

export const dynamic = "force-dynamic";

/** Lightweight check for Vercel env setup (no secrets exposed). */
export async function GET() {
  return Response.json({
    ok: isSupabaseConfigured(),
    supabasePublic: isSupabaseConfigured(),
    supabaseServiceRole: Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
        process.env.SUPABASE_SERVICE_ROLE_KEY !== "placeholder",
    ),
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
  });
}
