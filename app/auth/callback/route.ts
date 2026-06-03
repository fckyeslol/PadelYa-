import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getPublicSupabaseEnv } from "@/utils/env";
import { upsertProfile } from "@/services/profiles/service";

function createCallbackSupabase(
  request: NextRequest,
  response: NextResponse,
) {
  const { url, anonKey } = getPublicSupabaseEnv();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/matches";

  const authError = searchParams.get("error_description") ?? searchParams.get("error");
  if (authError) {
    return NextResponse.redirect(
      `${origin}/login?error=auth_failed&detail=${encodeURIComponent(authError)}`,
    );
  }

  const response = NextResponse.redirect(`${origin}${next}`);
  const supabase = createCallbackSupabase(request, response);

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) {
      console.error("[auth/callback] exchangeCodeForSession", error);
      return NextResponse.redirect(
        `${origin}/login?error=auth_failed&detail=${encodeURIComponent(error?.message ?? "session")}`,
      );
    }

    // Password reset via PKCE flow — type=recovery arrives alongside the code
    if (type === "recovery") {
      const recoveryTarget = NextResponse.redirect(`${origin}/auth/update-password`);
      response.cookies.getAll().forEach(({ name, value, ...opts }) => {
        recoveryTarget.cookies.set(name, value, opts as Parameters<typeof recoveryTarget.cookies.set>[2]);
      });
      return recoveryTarget;
    }

    await ensureProfile(data.user.id, data.user.user_metadata, data.user.email);

    const incomplete = await isProfileIncomplete(data.user.id);
    if (incomplete) {
      return redirectToSetup(origin, next, response);
    }
    return response;
  }

  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });

    if (error || !data.user) {
      console.error("[auth/callback] verifyOtp", error);
      return NextResponse.redirect(
        `${origin}/login?error=auth_failed&detail=${encodeURIComponent(error?.message ?? "otp")}`,
      );
    }

    // Password reset: skip profile setup; send straight to the update-password page
    if (type === "recovery") {
      const recoveryTarget = NextResponse.redirect(`${origin}/auth/update-password`);
      response.cookies.getAll().forEach(({ name, value, ...opts }) => {
        recoveryTarget.cookies.set(name, value, opts as Parameters<typeof recoveryTarget.cookies.set>[2]);
      });
      return recoveryTarget;
    }

    await ensureProfile(data.user.id, data.user.user_metadata, data.user.email);

    const incomplete = await isProfileIncomplete(data.user.id);
    if (incomplete) {
      return redirectToSetup(origin, next, response);
    }
    return response;
  }

  return NextResponse.redirect(`${origin}/login?error=missing_code`);
}

function redirectToSetup(origin: string, next: string, sessionResponse: NextResponse) {
  const setupUrl = `${origin}/profile?setup=1&next=${encodeURIComponent(next)}`;
  const setupResponse = NextResponse.redirect(setupUrl);
  // Copy session cookies so the user is logged in after the redirect
  sessionResponse.cookies.getAll().forEach(({ name, value, ...opts }) => {
    setupResponse.cookies.set(name, value, opts as Parameters<typeof setupResponse.cookies.set>[2]);
  });
  return setupResponse;
}

async function isProfileIncomplete(userId: string): Promise<boolean> {
  try {
    const { getSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const admin = getSupabaseAdminClient();
    const { data } = await admin
      .from("profiles")
      .select("phone")
      .eq("id", userId)
      .maybeSingle();
    return !data?.phone;
  } catch {
    return false;
  }
}

async function ensureProfile(
  userId: string,
  meta: Record<string, unknown>,
  email: string | undefined,
) {
  const firstName = (meta.first_name as string | undefined)?.trim() ?? "";
  const lastName = (meta.last_name as string | undefined)?.trim() ?? "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || (email ?? "");

  try {
    await upsertProfile(userId, { fullName });
  } catch (profileError) {
    console.error("[auth/callback] profile upsert failed", profileError);
  }
}
