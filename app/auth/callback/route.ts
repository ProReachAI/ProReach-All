import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { appOrigin } from "@/lib/app-origin";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = appOrigin();

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

  return NextResponse.redirect(new URL("/dashboard", origin));
}
