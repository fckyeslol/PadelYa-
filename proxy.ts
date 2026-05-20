import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getPublicSupabaseEnv, isSupabaseConfigured } from "@/utils/env";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    return supabaseResponse;
  }

  try {
    const { url, anonKey } = getPublicSupabaseEnv();

    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    });

    await supabase.auth.getUser();
  } catch (error) {
    console.error("[proxy] Supabase session refresh failed", error);
  }

  supabaseResponse.headers.set("x-pathname", request.nextUrl.pathname);
  return supabaseResponse;
}

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and static assets
    "/((?!_next/static|_next/image|favicon.ico|logo\\.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
