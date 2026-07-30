import { createClient } from "@/lib/supabase/server";

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
};

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication is required.");
    this.name = "AuthenticationRequiredError";
  }
}

export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims || typeof data.claims.sub !== "string") throw new AuthenticationRequiredError();

  const claims = data.claims as Record<string, unknown>;
  const metadata = claims.user_metadata && typeof claims.user_metadata === "object"
    ? claims.user_metadata as Record<string, unknown>
    : {};
  const email = typeof claims.email === "string" ? claims.email : "Signed-in user";
  const name = typeof metadata.full_name === "string"
    ? metadata.full_name
    : typeof metadata.name === "string"
      ? metadata.name
      : email.split("@")[0];

  return { id: data.claims.sub, email, name };
}
