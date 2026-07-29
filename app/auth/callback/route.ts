import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

function appOrigin(request: Request) {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.APP_URL;
  if (configuredOrigin) {
    try {
      return new URL(configuredOrigin).origin;
    } catch {
      // Fall back to the request origin when deployment configuration is invalid.
    }
  }
  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = appOrigin(request);

  if (requestUrl.searchParams.has("error")) {
    return NextResponse.redirect(new URL("/login?error=oauth_denied", origin));
  }

  const code = requestUrl.searchParams.get("code");
  if (!code || !isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login?error=oauth_callback", origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=oauth_callback", origin));
  }

  return NextResponse.redirect(new URL("/", origin));
}
