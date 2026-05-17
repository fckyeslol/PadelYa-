import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getPublicSupabaseEnv } from "@/utils/env";
import { upsertProfile } from "@/services/profiles/service";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/matches";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  // Create the redirect response FIRST so we can attach session cookies to it
  const response = NextResponse.redirect(`${origin}${next}`);

  const { url, anonKey } = getPublicSupabaseEnv();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // In Next.js 16, response cookies are enough for the redirect session handoff.
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const user = data.user;
  const meta = user.user_metadata ?? {};

  const firstName = (meta.first_name as string | undefined)?.trim() ?? "";
  const lastName = (meta.last_name as string | undefined)?.trim() ?? "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || (user.email ?? "");

  try {
    await upsertProfile(user.id, { fullName });
  } catch {
    // Non-fatal: profile may already exist and be up to date
  }

  return response;
}
