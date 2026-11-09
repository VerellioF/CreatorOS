import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicSupabaseConfig } from "@/lib/env/env";
import { sanitizeRedirectPath } from "@/lib/security/sanitize";
import type { Database } from "./types";

function isAuthRoute(pathname: string): boolean {
  return (
    pathname === "/sign-in" ||
    pathname.startsWith("/sign-in/") ||
    pathname === "/sign-up" ||
    pathname.startsWith("/sign-up/") ||
    pathname === "/forgot-password" ||
    pathname.startsWith("/forgot-password/")
  );
}

function isPublicRoute(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/demo" ||
    isAuthRoute(pathname) ||
    pathname === "/auth/callback" ||
    pathname.startsWith("/auth/callback/") ||
    pathname === "/api/health"
  );
}

function redirectWithCookies(url: URL, sourceResponse: NextResponse): NextResponse {
  const redirectResponse = NextResponse.redirect(url);
  for (const cookie of sourceResponse.cookies.getAll()) {
    redirectResponse.cookies.set(cookie);
  }
  return redirectResponse;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const { url: supabaseUrl, anonKey: supabaseAnonKey } = getPublicSupabaseConfig();

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const authRoute = isAuthRoute(pathname);
  // Default-deny: every non-public route requires a verified server session
  const protectedRoute = !isPublicRoute(pathname);

  if (!user && protectedRoute) {
    const url = request.nextUrl.clone();
    const safeRedirect = sanitizeRedirectPath(
      `${pathname}${request.nextUrl.search}`,
      "/dashboard"
    );
    url.pathname = "/sign-in";
    url.search = "";
    url.searchParams.set("redirectTo", safeRedirect);
    return redirectWithCookies(url, supabaseResponse);
  }

  if (user && authRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return redirectWithCookies(url, supabaseResponse);
  }

  return supabaseResponse;
}
