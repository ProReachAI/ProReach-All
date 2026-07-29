import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { assertEncryptionReady, createPkce, createState } from "@/lib/security/crypto";
import { createOAuthSession } from "@/lib/integrations/repository";
import { callbackUrl, getProviderCredentials, isProvider, providerConfig } from "@/lib/integrations/providers";
import { canonicalOAuthStartUrl } from "@/lib/integrations/oauth-origin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ platform: string }> }) {
  const { platform: value } = await context.params;
  if (!isProvider(value)) return NextResponse.json({ error: "Unsupported integration provider" }, { status: 404 });

  // The browser-binding cookie and provider callback must use the same host.
  // In local development APP_URL is usually an HTTPS tunnel, while the UI may
  // have been opened on localhost. Move to the canonical host before creating
  // the OAuth session so the callback can read the binding cookie.
  const incomingHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const canonicalStart = canonicalOAuthStartUrl(request.url, process.env.APP_URL, incomingHost);
  if (canonicalStart) return NextResponse.redirect(canonicalStart);

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) return NextResponse.redirect(new URL("/login", request.url));

  try {
    const config = providerConfig[value];
    const requestUrl = new URL(request.url);
    const scopes = value === "linkedin" && requestUrl.searchParams.get("mode") === "organization"
      ? [...config.scopes, "rw_organization_admin", "w_organization_social"]
      : config.scopes;
    const { clientId } = getProviderCredentials(value);
    await assertEncryptionReady();
    const state = createState();
    const binding = createState();
    const pkce = config.usesPkce ? await createPkce() : undefined;
    await createOAuthSession({ provider: value, state, binding, pkceVerifier: pkce?.verifier });

    const cookieStore = await cookies();
    const secure = process.env.NODE_ENV === "production";
    cookieStore.set(`oauth_binding_${value}_${state.slice(0, 12)}`, binding, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/api/oauth",
      maxAge: 600,
    });

    const query = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: callbackUrl(value),
      scope: scopes.join(config.scopeSeparator),
      state,
    });
    for (const [key, value] of Object.entries(config.authorizeParams ?? {})) query.set(key, value);
    if (pkce) {
      query.set("code_challenge", pkce.challenge);
      query.set("code_challenge_method", "S256");
    }
    return NextResponse.redirect(`${config.authorizeUrl}?${query}`);
  } catch (error) {
    console.error("OAuth start failed", value, error instanceof Error ? error.message : "Unknown error");
    const target = new URL("/dashboard", process.env.APP_URL ?? "http://localhost:3000");
    target.searchParams.set("view", "connections");
    target.searchParams.set("integration_error", "not_configured");
    target.searchParams.set("provider", value);
    return NextResponse.redirect(target);
  }
}
