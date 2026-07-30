import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPool } from "@/lib/db";
import { consumeOAuthSession, createOAuthSession } from "@/lib/integrations/repository";
import { randomUUID } from "node:crypto";

const databaseDescribe = process.env.TEST_DATABASE_URL ? describe : describe.skip;

databaseDescribe("OAuth session repository", () => {
  const userId = randomUUID();
  const projectId = randomUUID();

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.TOKEN_ENCRYPTION_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    await getPool().query("delete from oauth_sessions");
    const workspace = await getPool().query(
      "insert into workspaces (name, slug, owner_user_id) values ('OAuth test', $1, $2) returning id",
      [`oauth-test-${userId}`, userId],
    );
    await getPool().query(
      `insert into projects (id, workspace_id, name, slug, one_liner, description, problem_statement, solution,
        target_audience, audience_pain_points, differentiators, proof_points, brand_voice, primary_goal, primary_cta)
       values ($1, $2, 'OAuth test project', $3, 'A sufficiently long one liner', 'A sufficiently long project description for OAuth testing.',
        'A sufficiently long problem statement.', 'A sufficiently long solution statement.', 'A sufficiently long target audience statement.',
        'A sufficiently long audience pain point statement.', 'A sufficiently long differentiator statement.', 'Useful proof',
        'Clear professional voice', 'A sufficiently clear primary goal.', 'Start now')`,
      [projectId, workspace.rows[0].id, `oauth-project-${userId}`],
    );
  });

  afterAll(async () => {
    await getPool().query("delete from oauth_sessions");
    await getPool().query("delete from workspaces where owner_user_id=$1", [userId]);
    await getPool().end();
  });

  it("binds state to the initiating browser and consumes it once", async () => {
    await createOAuthSession({
      userId,
      projectId,
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
