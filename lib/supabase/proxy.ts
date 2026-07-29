import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

function copyCookies(source: NextResponse, destination: NextResponse) {
  source.cookies.getAll().forEach((cookie) => destination.cookies.set(cookie));
  return destination;
}

function redirectWithCookies(request: NextRequest, response: NextResponse, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return copyCookies(response, NextResponse.redirect(url));
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isLogin = pathname === "/login";
  const isAuthRoute = pathname.startsWith("/auth/");
  const isScheduler = pathname === "/api/cron/publish";

  if (isScheduler) return NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    if (isLogin || isAuthRoute) return NextResponse.next({ request });
    return redirectWithCookies(request, NextResponse.next({ request }), "/login");
  }

  let supabaseResponse = NextResponse.next({ request });
  const { url, publishableKey } = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  };
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  // getClaims verifies the JWT signature and refreshes expired sessions.
  const authenticated = await supabase.auth.getClaims()
    .then(({ data }) => Boolean(data?.claims))
    .catch(() => false);

  if (authenticated && isLogin) {
    return redirectWithCookies(request, supabaseResponse, "/");
  }

  if (!authenticated && !isLogin && !isAuthRoute) {
    if (pathname.startsWith("/api/") && !pathname.startsWith("/api/oauth/")) {
      return copyCookies(
        supabaseResponse,
        NextResponse.json({ error: "Authentication required." }, { status: 401 }),
      );
    }
    return redirectWithCookies(request, supabaseResponse, "/login");
  }

  return supabaseResponse;
}
