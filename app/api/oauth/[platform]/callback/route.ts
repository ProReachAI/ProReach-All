import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { completeAuthorization, isProvider } from "@/lib/integrations/providers";
import { consumeOAuthSession, saveAuthorization } from "@/lib/integrations/repository";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ platform: string }> }) {
  const { platform: value } = await context.params;
  if (!isProvider(value)) return NextResponse.json({ error: "Unsupported integration provider" }, { status: 404 });
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  const cookieStore = await cookies();
  const cookieName = returnedState ? `oauth_binding_${value}_${returnedState.slice(0, 12)}` : "";
  const binding = cookieName ? cookieStore.get(cookieName)?.value : undefined;
  if (cookieName) cookieStore.delete(cookieName);

  try {
    if (!returnedState || !binding) throw new Error("OAuth browser binding is missing.");
    const session = await consumeOAuthSession(value, returnedState, binding);
    if (providerError) return redirectToConnections({ provider: value, outcome: "cancelled" });
    if (!code) throw new Error("The provider did not return an authorization code.");
    const result = await completeAuthorization(value, code, session.pkceVerifier);
    const saved = await saveAuthorization(result);
    return redirectToConnections({
      provider: value,
      outcome: "connected",
      accounts: result.accounts.length,
      selectIntegration: saved.requiresSelection ? saved.integrationId : undefined,
    });
  } catch (error) {
    console.error("OAuth callback failed", error instanceof Error ? error.message : "Unknown error");
    return redirectToConnections({ provider: value, outcome: "failed" });
  }
}

function redirectToConnections(input: { provider: string; outcome: "connected" | "cancelled" | "failed"; accounts?: number; selectIntegration?: string }) {
  const target = new URL("/dashboard", process.env.APP_URL ?? "http://localhost:3000");
  target.searchParams.set("view", "connections");
  target.searchParams.set("integration", input.outcome);
  target.searchParams.set("provider", input.provider);
  if (input.accounts !== undefined) target.searchParams.set("accounts", String(input.accounts));
  if (input.selectIntegration) target.searchParams.set("select_integration", input.selectIntegration);
  return NextResponse.redirect(target);
}
