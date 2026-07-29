import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPool } from "@/lib/db";
import { consumeOAuthSession, createOAuthSession } from "@/lib/integrations/repository";

const databaseDescribe = process.env.TEST_DATABASE_URL ? describe : describe.skip;

databaseDescribe("OAuth session repository", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.TOKEN_ENCRYPTION_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    await getPool().query("delete from oauth_sessions");
  });

  afterAll(async () => {
    await getPool().query("delete from oauth_sessions");
    await getPool().end();
  });

  it("binds state to the initiating browser and consumes it once", async () => {
    await createOAuthSession({
      provider: "x",
      state: "state-value",
      binding: "browser-binding",
      pkceVerifier: "pkce-verifier",
    });

    await expect(consumeOAuthSession("x", "state-value", "wrong-browser")).rejects.toThrow(/expired|used|another browser/);
    await expect(consumeOAuthSession("x", "state-value", "browser-binding")).resolves.toMatchObject({ pkceVerifier: "pkce-verifier" });
    await expect(consumeOAuthSession("x", "state-value", "browser-binding")).rejects.toThrow(/expired|used|another browser/);
  });
});
