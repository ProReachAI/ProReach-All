import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { assertEncryptionReady, createPkce, createState } from "@/lib/security/crypto";
import { createOAuthSession } from "@/lib/integrations/repository";
import { authorizationScopes, callbackUrl, getProviderCredentials, isProvider, providerConfig } from "@/lib/integrations/providers";
import { canonicalOAuthStartUrl } from "@/lib/integrations/oauth-origin";
import { appOrigin, appUrl } from "@/lib/app-origin";
import { createClient } from "@/lib/supabase/server";
import { getProject } from "@/lib/projects";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ platform: string }> }) {
  const { platform: value } = await context.params;
  if (!isProvider(value)) return NextResponse.json({ error: "Unsupported integration provider" }, { status: 404 });

  // The browser-binding cookie and provider callback must use the same host.
  // In local development APP_URL is usually an HTTPS tunnel, while the UI may
  // have been opened on localhost. Move to the canonical host before creating
  // the OAuth session so the callback can read the binding cookie.
  const incomingHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const canonicalStart = canonicalOAuthStartUrl(request.url, appOrigin(), incomingHost);
  if (canonicalStart) return NextResponse.redirect(canonicalStart);

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) return NextResponse.redirect(new URL("/login", request.url));

  try {
    const config = providerConfig[value];
    const requestUrl = new URL(request.url);
    const projectId = requestUrl.searchParams.get("project");
    const userId = typeof authData.claims.sub === "string" ? authData.claims.sub : undefined;
    if (!userId || !projectId || !await getProject(userId, projectId)) {
      throw new Error("Choose a valid project before connecting a social account.");
    }
    const scopes = authorizationScopes(value);
    const { clientId } = getProviderCredentials(value);
    await assertEncryptionReady();
    const state = createState();
    const binding = createState();
    const pkce = config.usesPkce ? await createPkce() : undefined;
    const returnTo = `/dashboard?project=${encodeURIComponent(projectId)}&view=connections`;
    await createOAuthSession({ userId, projectId, provider: value, state, binding, pkceVerifier: pkce?.verifier, returnTo });

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
    const target = appUrl("/dashboard");
    target.searchParams.set("view", "connections");
    target.searchParams.set("integration_error", "not_configured");
    target.searchParams.set("provider", value);
    const projectId = new URL(request.url).searchParams.get("project");
    if (projectId) target.searchParams.set("project", projectId);
    return NextResponse.redirect(target);
  }
}
