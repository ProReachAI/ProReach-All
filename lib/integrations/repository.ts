import { getPool, hasDatabase } from "@/lib/db";
import { decryptSecret, encryptSecret, sha256Hex } from "@/lib/security/crypto";
import { integrationProviders, providerLabel, type ConnectionSummary, type IntegrationProvider } from "@/lib/types";
import { isProviderConfigured } from "@/lib/integrations/providers";
import type { AuthorizationResult } from "@/lib/integrations/types";

const notes: Record<IntegrationProvider, string> = {
  meta: "Facebook Page publishing",
  instagram: "Direct professional-account publishing — no Facebook Page link required",
  threads: "Threads profile publishing",
  x: "X OAuth 2.0 publishing with offline access",
  linkedin: "LinkedIn company Page publishing through the reviewed Community Management API",
};

async function defaultWorkspaceId() {
  const result = await getPool().query("select id from workspaces where slug = 'default'");
  const id = result.rows[0]?.id as string | undefined;
  if (!id) throw new Error("The default workspace does not exist. Run db/schema.sql first.");
  return id;
}

export async function createOAuthSession(input: {
  provider: IntegrationProvider;
  state: string;
  binding: string;
  pkceVerifier?: string;
  returnTo?: string;
}) {
  const workspaceId = await defaultWorkspaceId();
  const stateHash = await sha256Hex(input.state);
  const bindingHash = await sha256Hex(input.binding);
  const pkceCiphertext = input.pkceVerifier ? await encryptSecret(input.pkceVerifier) : null;
  const returnTo = input.returnTo?.startsWith("/") && !input.returnTo.startsWith("//") ? input.returnTo : "/dashboard?view=connections";
  await getPool().query(
    `insert into oauth_sessions (
       workspace_id, provider, state_hash, binding_hash, pkce_verifier_ciphertext, return_to, expires_at
     ) values ($1, $2, $3, $4, $5, $6, now() + interval '10 minutes')`,
    [workspaceId, input.provider, stateHash, bindingHash, pkceCiphertext, returnTo],
  );
}

export async function consumeOAuthSession(provider: IntegrationProvider, state: string, binding: string) {
  const stateHash = await sha256Hex(state);
  const bindingHash = await sha256Hex(binding);
  const result = await getPool().query(
    `update oauth_sessions
        set consumed_at = now()
      where provider = $1 and state_hash = $2 and binding_hash = $3
        and consumed_at is null and expires_at > now()
      returning pkce_verifier_ciphertext, return_to`,
    [provider, stateHash, bindingHash],
  );
  const row = result.rows[0] as { pkce_verifier_ciphertext?: string; return_to: string } | undefined;
  if (!row) throw new Error("The authorization request expired, was already used, or came from another browser.");
  return {
    pkceVerifier: row.pkce_verifier_ciphertext ? await decryptSecret(row.pkce_verifier_ciphertext) : undefined,
    returnTo: row.return_to,
  };
}

export async function saveAuthorization(result: AuthorizationResult) {
  const workspaceId = await defaultWorkspaceId();
  const accessCiphertext = await encryptSecret(result.token.accessToken);
  const refreshCiphertext = result.token.refreshToken ? await encryptSecret(result.token.refreshToken) : null;
  const encryptedAccounts = await Promise.all(result.accounts.map(async (account) => ({
    ...account,
    ciphertext: await encryptSecret(account.accessToken),
  })));
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const integration = await client.query(
      `insert into integrations (
         workspace_id, provider, provider_user_id, display_name, access_token_ciphertext,
         refresh_token_ciphertext, token_expires_at, refresh_token_expires_at, scopes,
         status, last_error, last_verified_at, metadata
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', null, now(), $10)
       on conflict (workspace_id, provider, provider_user_id) do update set
         display_name = excluded.display_name,
         access_token_ciphertext = excluded.access_token_ciphertext,
         refresh_token_ciphertext = excluded.refresh_token_ciphertext,
         token_expires_at = excluded.token_expires_at,
         refresh_token_expires_at = excluded.refresh_token_expires_at,
         scopes = excluded.scopes,
         status = 'active',
         last_error = null,
         last_verified_at = now(),
         metadata = excluded.metadata,
         updated_at = now()
       returning id`,
      [
        workspaceId, result.provider, result.providerUserId, result.displayName,
        accessCiphertext, refreshCiphertext, result.token.expiresAt ?? null,
        result.token.refreshExpiresAt ?? null, result.token.scopes, result.metadata ?? {},
      ],
    );
    const integrationId = integration.rows[0].id as string;
    const previousSelection = await client.query(
      "select provider_account_id from social_accounts where integration_id = $1 and enabled = true",
      [integrationId],
    );
    const previouslyEnabled = new Set(previousSelection.rows.map((row) => String(row.provider_account_id)));
    await client.query("delete from social_accounts where integration_id = $1", [integrationId]);

    let enabledCount = 0;
    for (const account of encryptedAccounts) {
      const enabled = encryptedAccounts.length === 1 || previouslyEnabled.has(account.providerAccountId);
      if (enabled) enabledCount += 1;
      await client.query(
        `insert into social_accounts (
           workspace_id, integration_id, platform, provider_account_id, display_name,
           access_token_ciphertext, refresh_token_ciphertext, token_expires_at, scopes, enabled, metadata
         ) values ($1, $2, $3, $4, $5, $6, null, $7, $8, $9, $10)
         on conflict (workspace_id, platform, provider_account_id) do update set
           integration_id = excluded.integration_id,
           display_name = excluded.display_name,
           access_token_ciphertext = excluded.access_token_ciphertext,
           token_expires_at = excluded.token_expires_at,
           scopes = excluded.scopes,
           enabled = excluded.enabled,
           metadata = excluded.metadata,
           updated_at = now()`,
        [
          workspaceId, integrationId, account.platform, account.providerAccountId,
          account.displayName, account.ciphertext, account.tokenExpiresAt ?? null,
          result.token.scopes, enabled, account.metadata ?? {},
        ],
      );
    }
    await client.query("commit");
    return {
      integrationId,
      accountCount: encryptedAccounts.length,
      requiresSelection: encryptedAccounts.length > 1 && enabledCount === 0,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function listConnections(): Promise<ConnectionSummary[]> {
  const base = integrationProviders.map((provider) => ({
    provider,
    label: providerLabel[provider],
    connected: false,
    configured: isProviderConfigured(provider),
    accounts: [],
    note: notes[provider],
  } satisfies ConnectionSummary));
  if (!hasDatabase()) return base;

  const integrations = await getPool().query(
    `select distinct on (provider)
       id, provider, display_name, status, token_expires_at
     from integrations
     where workspace_id = (select id from workspaces where slug = 'default')
     order by provider, updated_at desc`,
  );
  if (!integrations.rowCount) return base;
  const ids = integrations.rows.map((row) => row.id);
  const accounts = await getPool().query(
    `select id, integration_id, platform, provider_account_id, display_name, enabled, metadata
       from social_accounts where integration_id = any($1::uuid[]) order by platform, display_name`,
    [ids],
  );

  return base.map((summary) => {
    const integration = integrations.rows.find((row) => row.provider === summary.provider);
    if (!integration) return summary;
    return {
      ...summary,
      id: integration.id,
      connected: integration.status === "active",
      status: integration.status,
      accountName: integration.display_name ?? undefined,
      expiresAt: integration.token_expires_at?.toISOString?.() ?? integration.token_expires_at ?? null,
      accounts: accounts.rows.filter((row) => row.integration_id === integration.id).map((row) => ({
        id: row.id,
        platform: row.platform,
        displayName: row.display_name ?? row.provider_account_id,
        username: row.metadata?.username ? String(row.metadata.username) : undefined,
        destinationType: row.metadata?.destinationType === "organization" ? "organization" : "person",
        enabled: row.enabled !== false,
      })),
    };
  });
}

export async function setEnabledSocialAccounts(integrationId: string, accountIds: string[]) {
  if (accountIds.length === 0) throw new Error("Choose at least one publishing destination.");
  const workspaceId = await defaultWorkspaceId();
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const owned = await client.query(
      `select id from social_accounts
        where workspace_id = $1 and integration_id = $2 and id = any($3::uuid[])`,
      [workspaceId, integrationId, accountIds],
    );
    if (owned.rowCount !== accountIds.length) throw new Error("One or more destinations do not belong to this connection.");
    await client.query(
      "update social_accounts set enabled = false, updated_at = now() where workspace_id = $1 and integration_id = $2",
      [workspaceId, integrationId],
    );
    await client.query(
      "update social_accounts set enabled = true, updated_at = now() where workspace_id = $1 and integration_id = $2 and id = any($3::uuid[])",
      [workspaceId, integrationId, accountIds],
    );
    await client.query("commit");
    return accountIds;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getIntegrationSecret(id: string) {
  const result = await getPool().query(
    `select id, provider, access_token_ciphertext, refresh_token_ciphertext,
            token_expires_at, refresh_token_expires_at, scopes
       from integrations
      where id = $1 and workspace_id = (select id from workspaces where slug = 'default')`,
    [id],
  );
  const row = result.rows[0] as {
    id: string;
    provider: IntegrationProvider;
    access_token_ciphertext: string;
    refresh_token_ciphertext?: string;
    token_expires_at?: Date;
    refresh_token_expires_at?: Date;
    scopes: string[];
  } | undefined;
  if (!row) return undefined;
  return {
    id: row.id,
    provider: row.provider,
    accessToken: await decryptSecret(row.access_token_ciphertext),
    refreshToken: row.refresh_token_ciphertext ? await decryptSecret(row.refresh_token_ciphertext) : undefined,
    expiresAt: row.token_expires_at,
    refreshExpiresAt: row.refresh_token_expires_at,
    scopes: row.scopes,
  };
}

export async function updateIntegrationTokens(id: string, token: {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  refreshExpiresAt?: Date;
  scopes: string[];
}) {
  const accessCiphertext = await encryptSecret(token.accessToken);
  const refreshCiphertext = token.refreshToken ? await encryptSecret(token.refreshToken) : null;
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query(
      `update integrations set
         access_token_ciphertext = $2,
         refresh_token_ciphertext = coalesce($3, refresh_token_ciphertext),
         token_expires_at = $4,
         refresh_token_expires_at = coalesce($5, refresh_token_expires_at),
         scopes = $6,
         status = 'active', last_error = null, last_verified_at = now(), updated_at = now()
       where id = $1`,
      [id, accessCiphertext, refreshCiphertext, token.expiresAt ?? null, token.refreshExpiresAt ?? null, token.scopes],
    );
    await client.query(
      `update social_accounts set access_token_ciphertext = $2, token_expires_at = $3,
         scopes = $4, updated_at = now() where integration_id = $1`,
      [id, accessCiphertext, token.expiresAt ?? null, token.scopes],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function markIntegrationVerified(id: string) {
  await getPool().query(
    `update integrations set status = 'active', last_error = null, last_verified_at = now(), updated_at = now()
      where id = $1 and workspace_id = (select id from workspaces where slug = 'default')`,
    [id],
  );
}

export async function markIntegrationError(id: string, error: string) {
  await getPool().query(
    `update integrations set status = 'error', last_error = $2, updated_at = now()
      where id = $1 and workspace_id = (select id from workspaces where slug = 'default')`,
    [id, error.slice(0, 1000)],
  );
}

export async function deleteIntegration(id: string) {
  await getPool().query(
    `delete from integrations where id = $1 and workspace_id = (select id from workspaces where slug = 'default')`,
    [id],
  );
}
