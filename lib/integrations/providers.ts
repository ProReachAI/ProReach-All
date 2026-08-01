import type { IntegrationProvider } from "@/lib/types";
import type { AuthorizationResult, OAuthToken } from "@/lib/integrations/types";
import { appUrl } from "@/lib/app-origin";

export type ProviderConfig = {
  authorizeUrl: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  scopes: string[];
  usesPkce: boolean;
  scopeSeparator: " " | ",";
  authorizeParams?: Record<string, string>;
};

const metaVersion = () => process.env.META_GRAPH_VERSION ?? "v25.0";

export const providerConfig: Record<IntegrationProvider, ProviderConfig> = {
  meta: {
    authorizeUrl: `https://www.facebook.com/${metaVersion()}/dialog/oauth`,
    clientIdEnv: "META_APP_ID",
    clientSecretEnv: "META_APP_SECRET",
    scopes: ["pages_show_list", "pages_read_engagement", "pages_manage_posts"],
    usesPkce: false,
    scopeSeparator: ",",
  },
  instagram: {
    authorizeUrl: "https://www.instagram.com/oauth/authorize",
    clientIdEnv: "INSTAGRAM_APP_ID",
    clientSecretEnv: "INSTAGRAM_APP_SECRET",
    scopes: ["instagram_business_basic", "instagram_business_content_publish"],
    usesPkce: false,
    scopeSeparator: ",",
    authorizeParams: { enable_fb_login: "0", force_authentication: "1" },
  },
  x: {
    authorizeUrl: "https://x.com/i/oauth2/authorize",
    clientIdEnv: "X_CLIENT_ID",
    clientSecretEnv: "X_CLIENT_SECRET",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    usesPkce: true,
    scopeSeparator: " ",
  },
  threads: {
    authorizeUrl: "https://threads.net/oauth/authorize",
    clientIdEnv: "THREADS_CLIENT_ID",
    clientSecretEnv: "THREADS_CLIENT_SECRET",
    scopes: ["threads_basic", "threads_content_publish"],
    usesPkce: false,
    scopeSeparator: ",",
  },
  linkedin: {
    authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
    clientIdEnv: "LINKEDIN_CLIENT_ID",
    clientSecretEnv: "LINKEDIN_CLIENT_SECRET",
    scopes: ["openid", "profile", "w_member_social"],
    usesPkce: false,
    scopeSeparator: " ",
  },
};

const linkedInOrganizationScopes = ["rw_organization_admin", "w_organization_social"];

/**
 * LinkedIn rejects the complete authorization request when it contains scopes
 * that have not been provisioned for the developer app. Personal profile
 * publishing is self-service, while company Page publishing requires approved
 * Community Management API access. Keep the restricted scopes opt-in so a
 * normal production connection can always reach LinkedIn's consent screen.
 */
export function authorizationScopes(provider: IntegrationProvider) {
  const scopes = providerConfig[provider].scopes;
  if (provider !== "linkedin" || process.env.LINKEDIN_ORGANIZATION_ACCESS !== "true") {
    return scopes;
  }
  return [...scopes, ...linkedInOrganizationScopes];
}

export function isProvider(value: string): value is IntegrationProvider {
  return value in providerConfig;
}

export function callbackUrl(provider: IntegrationProvider) {
  return appUrl(`/api/oauth/${provider}/callback`).toString();
}

export function getProviderCredentials(provider: IntegrationProvider) {
  const config = providerConfig[provider];
  const clientId = process.env[config.clientIdEnv];
  const clientSecret = process.env[config.clientSecretEnv];
  if (!clientId || !clientSecret) {
    throw new Error(`${provider} OAuth is not configured. Set ${config.clientIdEnv} and ${config.clientSecretEnv}.`);
  }
  return { clientId, clientSecret };
}

export function isProviderConfigured(provider: IntegrationProvider) {
  const config = providerConfig[provider];
  return Boolean(process.env[config.clientIdEnv] && process.env[config.clientSecretEnv]);
}

type RawToken = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  scope?: string;
  token_type?: string;
  user_id?: string | number;
  error?: string | { message?: string };
  error_description?: string;
};

async function readJson(response: Response, provider: IntegrationProvider) {
  const text = await response.text();
  let payload: RawToken & Record<string, unknown>;
  try {
    payload = JSON.parse(text) as RawToken & Record<string, unknown>;
  } catch {
    throw new Error(`${provider} returned an invalid response (${response.status}).`);
  }
  if (!response.ok) {
    const nestedMessage = typeof payload.error === "object" ? payload.error.message : undefined;
    throw new Error(`${provider} authorization failed: ${payload.error_description ?? nestedMessage ?? payload.error ?? response.status}`);
  }
  return payload;
}

function tokenFrom(raw: RawToken, scopes: string[]): OAuthToken {
  if (!raw.access_token) throw new Error("The provider did not return an access token.");
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token,
    expiresAt: raw.expires_in ? new Date(Date.now() + raw.expires_in * 1000) : undefined,
    refreshExpiresAt: raw.refresh_token_expires_in ? new Date(Date.now() + raw.refresh_token_expires_in * 1000) : undefined,
    scopes: raw.scope?.split(/[ ,]+/).filter(Boolean) ?? scopes,
  };
}

async function exchangeStandard(provider: "linkedin" | "threads", code: string) {
  const config = providerConfig[provider];
  const { clientId, clientSecret } = getProviderCredentials(provider);
  const response = await fetch(provider === "linkedin" ? "https://www.linkedin.com/oauth/v2/accessToken" : "https://graph.threads.net/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl(provider),
      client_id: clientId,
      client_secret: clientSecret,
    }),
    cache: "no-store",
  });
  return tokenFrom(await readJson(response, provider), config.scopes);
}

async function exchangeX(code: string, verifier: string) {
  const provider = "x" as const;
  const { clientId, clientSecret } = getProviderCredentials(provider);
  const response = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl(provider),
      code_verifier: verifier,
    }),
    cache: "no-store",
  });
  return tokenFrom(await readJson(response, provider), providerConfig[provider].scopes);
}

async function exchangeMeta(code: string) {
  const provider = "meta" as const;
  const { clientId, clientSecret } = getProviderCredentials(provider);
  const tokenUrl = new URL(`https://graph.facebook.com/${metaVersion()}/oauth/access_token`);
  tokenUrl.search = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, redirect_uri: callbackUrl(provider), code }).toString();
  const short = tokenFrom(await readJson(await fetch(tokenUrl, { cache: "no-store" }), provider), providerConfig[provider].scopes);

  const longUrl = new URL(`https://graph.facebook.com/${metaVersion()}/oauth/access_token`);
  longUrl.search = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: clientId,
    client_secret: clientSecret,
    fb_exchange_token: short.accessToken,
  }).toString();
  return tokenFrom(await readJson(await fetch(longUrl, { cache: "no-store" }), provider), short.scopes);
}

async function exchangeInstagram(code: string) {
  const provider = "instagram" as const;
  const config = providerConfig[provider];
  const { clientId, clientSecret } = getProviderCredentials(provider);
  const shortResponse = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: callbackUrl(provider),
      code,
    }),
    cache: "no-store",
  });
  const short = tokenFrom(await readJson(shortResponse, provider), config.scopes);

  const longUrl = new URL("https://graph.instagram.com/access_token");
  longUrl.search = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: clientSecret,
    access_token: short.accessToken,
  }).toString();
  return tokenFrom(await readJson(await fetch(longUrl, { cache: "no-store" }), provider), short.scopes);
}

async function makeThreadsLongLived(short: OAuthToken) {
  const { clientSecret } = getProviderCredentials("threads");
  const url = new URL("https://graph.threads.net/access_token");
  url.search = new URLSearchParams({ grant_type: "th_exchange_token", client_secret: clientSecret, access_token: short.accessToken }).toString();
  return tokenFrom(await readJson(await fetch(url, { cache: "no-store" }), "threads"), short.scopes);
}

async function graphJson(url: string, accessToken: string, provider: IntegrationProvider) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  return readJson(response, provider);
}

async function discoverMeta(token: OAuthToken): Promise<AuthorizationResult> {
  const version = metaVersion();
  const identity = await graphJson(`https://graph.facebook.com/${version}/me?fields=id,name`, token.accessToken, "meta");
  const providerUserId = String(identity.id ?? "");
  if (!providerUserId) throw new Error("Meta did not return a user ID.");

  const accounts: AuthorizationResult["accounts"] = [];
  let next: string | undefined = `https://graph.facebook.com/${version}/me/accounts?fields=id,name,access_token,tasks&limit=100`;
  for (let page = 0; next && page < 10; page += 1) {
    const payload = await graphJson(next, token.accessToken, "meta");
    const rows = Array.isArray(payload.data) ? payload.data as Array<Record<string, unknown>> : [];
    for (const row of rows) {
      const pageId = String(row.id ?? "");
      const pageToken = String(row.access_token ?? "");
      if (!pageId || !pageToken) continue;
      const tasks = Array.isArray(row.tasks) ? row.tasks.map(String) : [];
      const canPublish = tasks.some((task) => [
        "CREATE_CONTENT",
        "MANAGE",
        "PROFILE_PLUS_CREATE_CONTENT",
        "PROFILE_PLUS_FULL_CONTROL",
        "PROFILE_PLUS_MANAGE",
      ].includes(task));
      if (!canPublish) continue;
      accounts.push({
        platform: "facebook",
        providerAccountId: pageId,
        displayName: String(row.name ?? "Facebook Page"),
        accessToken: pageToken,
        tokenExpiresAt: undefined,
        metadata: { tasks, canPublish },
      });
    }
    const paging = payload.paging as { next?: string } | undefined;
    if (paging?.next) {
      const candidate = new URL(paging.next);
      next = candidate.protocol === "https:" && candidate.hostname === "graph.facebook.com" ? candidate.toString() : undefined;
    } else next = undefined;
  }

  return {
    provider: "meta",
    providerUserId,
    displayName: String(identity.name ?? "Meta account"),
    token,
    metadata: { graphVersion: version },
    accounts,
  };
}

async function discoverInstagram(token: OAuthToken): Promise<AuthorizationResult> {
  const identity = await graphJson(
    `https://graph.instagram.com/${metaVersion()}/me?fields=id,user_id,username,name,profile_picture_url`,
    token.accessToken,
    "instagram",
  );
  const providerUserId = String(identity.id ?? identity.user_id ?? "");
  if (!providerUserId) throw new Error("Instagram did not return a professional account ID.");
  const username = identity.username ? String(identity.username) : undefined;
  const displayName = String(identity.name ?? username ?? "Instagram professional account");
  const metadata = {
    username,
    profilePictureUrl: identity.profile_picture_url,
    authScheme: "instagram_login",
    graphHost: "graph.instagram.com",
  };
  return {
    provider: "instagram",
    providerUserId,
    displayName,
    token,
    metadata,
    accounts: [{
      platform: "instagram",
      providerAccountId: providerUserId,
      displayName,
      accessToken: token.accessToken,
      tokenExpiresAt: token.expiresAt,
      metadata,
    }],
  };
}

async function discoverSingle(provider: "x" | "threads" | "linkedin", token: OAuthToken): Promise<AuthorizationResult> {
  const urls = {
    x: "https://api.x.com/2/users/me?user.fields=name,username,profile_image_url",
    threads: "https://graph.threads.net/v1.0/me?fields=id,username,name,threads_profile_picture_url",
    linkedin: "https://api.linkedin.com/v2/userinfo",
  };
  const payload = await graphJson(urls[provider], token.accessToken, provider);
  const identity = (payload.data ?? payload) as Record<string, unknown>;
  const id = String(identity.id ?? identity.sub ?? "");
  if (!id) throw new Error(`${provider} did not return an account ID.`);
  const name = String(identity.name ?? identity.username ?? provider);
  const username = identity.username ? String(identity.username) : undefined;
  return {
    provider,
    providerUserId: id,
    displayName: name,
    token,
    metadata: { username, picture: identity.picture ?? identity.profile_image_url ?? identity.threads_profile_picture_url },
    accounts: [{
      platform: provider,
      providerAccountId: id,
      displayName: name,
      accessToken: token.accessToken,
      tokenExpiresAt: token.expiresAt,
      metadata: { username, picture: identity.picture ?? identity.profile_image_url ?? identity.threads_profile_picture_url },
    }],
  };
}

async function linkedInJson(url: string, token: OAuthToken) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": process.env.LINKEDIN_API_VERSION ?? "202606",
    },
    cache: "no-store",
  });
  return readJson(response, "linkedin");
}

async function discoverLinkedIn(token: OAuthToken): Promise<AuthorizationResult> {
  const identity = await graphJson("https://api.linkedin.com/v2/userinfo", token.accessToken, "linkedin");
  const memberId = String(identity.sub ?? identity.id ?? "");
  if (!memberId) throw new Error("LinkedIn did not return a member ID.");
  const memberName = String(identity.name ?? "LinkedIn member");
  const accounts: AuthorizationResult["accounts"] = [{
    platform: "linkedin",
    providerAccountId: memberId,
    displayName: memberName,
    accessToken: token.accessToken,
    tokenExpiresAt: token.expiresAt,
    metadata: {
      destinationType: "person",
      authorUrn: `urn:li:person:${memberId}`,
      picture: identity.picture,
    },
  }];

  const hasOrganizationAccess = token.scopes.includes("rw_organization_admin") && token.scopes.includes("w_organization_social");
  if (hasOrganizationAccess) {
    const acl = await linkedInJson(
      "https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&state=APPROVED&count=100",
      token,
    );
    const rows = Array.isArray(acl.elements) ? acl.elements as Array<Record<string, unknown>> : [];
    const allowedRoles = new Set(["ADMINISTRATOR", "CONTENT_ADMIN", "CONTENT_ADMINISTRATOR", "DIRECT_SPONSORED_CONTENT_POSTER"]);
    for (const row of rows) {
      if (!allowedRoles.has(String(row.role ?? ""))) continue;
      const organizationUrn = String(row.organization ?? "");
      const organizationId = organizationUrn.match(/^urn:li:organization:(.+)$/)?.[1];
      if (!organizationId || accounts.some((account) => account.providerAccountId === organizationId)) continue;
      const organization = await linkedInJson(`https://api.linkedin.com/rest/organizations/${encodeURIComponent(organizationId)}`, token);
      accounts.push({
        platform: "linkedin",
        providerAccountId: organizationId,
        displayName: String(organization.localizedName ?? organization.name ?? `LinkedIn Page ${organizationId}`),
        accessToken: token.accessToken,
        tokenExpiresAt: token.expiresAt,
        metadata: {
          destinationType: "organization",
          authorUrn: organizationUrn,
          vanityName: organization.vanityName,
          role: row.role,
        },
      });
    }
  }

  return {
    provider: "linkedin",
    providerUserId: memberId,
    displayName: memberName,
    token,
    metadata: { organizationPublishingEnabled: hasOrganizationAccess },
    accounts,
  };
}

export async function completeAuthorization(provider: IntegrationProvider, code: string, pkceVerifier?: string) {
  if (provider === "meta") return discoverMeta(await exchangeMeta(code));
  if (provider === "instagram") return discoverInstagram(await exchangeInstagram(code));
  if (provider === "x") {
    if (!pkceVerifier) throw new Error("The X PKCE verifier is missing or expired.");
    return discoverSingle("x", await exchangeX(code, pkceVerifier));
  }
  if (provider === "threads") return discoverSingle("threads", await makeThreadsLongLived(await exchangeStandard("threads", code)));
  return discoverLinkedIn(await exchangeStandard("linkedin", code));
}

export async function verifyProviderIdentity(provider: IntegrationProvider, accessToken: string) {
  const urls: Record<IntegrationProvider, string> = {
    meta: `https://graph.facebook.com/${metaVersion()}/me?fields=id,name`,
    instagram: `https://graph.instagram.com/${metaVersion()}/me?fields=id,username`,
    x: "https://api.x.com/2/users/me?user.fields=name,username",
    threads: "https://graph.threads.net/v1.0/me?fields=id,username,name",
    linkedin: "https://api.linkedin.com/v2/userinfo",
  };
  await graphJson(urls[provider], accessToken, provider);
}

export async function refreshProviderToken(input: {
  provider: IntegrationProvider;
  accessToken: string;
  refreshToken?: string;
  scopes: string[];
}) {
  if (input.provider === "meta") throw new Error("Meta requires reconnection when the user grant expires.");
  if (input.provider === "instagram") {
    const url = new URL("https://graph.instagram.com/refresh_access_token");
    url.search = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: input.accessToken }).toString();
    return tokenFrom(await readJson(await fetch(url, { cache: "no-store" }), "instagram"), input.scopes);
  }
  if (input.provider === "threads") {
    const url = new URL("https://graph.threads.net/refresh_access_token");
    url.search = new URLSearchParams({ grant_type: "th_refresh_token", access_token: input.accessToken }).toString();
    return tokenFrom(await readJson(await fetch(url, { cache: "no-store" }), "threads"), input.scopes);
  }
  if (!input.refreshToken) throw new Error(`${input.provider} did not issue a refresh token; reconnect the account.`);
  const { clientId, clientSecret } = getProviderCredentials(input.provider);
  const url = input.provider === "x" ? "https://api.x.com/2/oauth2/token" : "https://www.linkedin.com/oauth/v2/accessToken";
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: input.refreshToken });
  if (input.provider === "x") {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  } else {
    body.set("client_id", clientId);
    body.set("client_secret", clientSecret);
  }
  return tokenFrom(await readJson(await fetch(url, { method: "POST", headers, body, cache: "no-store" }), input.provider), input.scopes);
}

export async function revokeProviderToken(provider: IntegrationProvider, accessToken: string) {
  if (provider === "x") {
    const { clientId, clientSecret } = getProviderCredentials("x");
    const response = await fetch("https://api.x.com/2/oauth2/revoke", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({ token: accessToken, client_id: clientId }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`X token revocation returned ${response.status}.`);
    return;
  }
  if (provider === "meta") {
    const response = await fetch(`https://graph.facebook.com/${metaVersion()}/me/permissions`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Meta token revocation returned ${response.status}.`);
    return;
  }
  if (provider === "instagram") {
    const response = await fetch(`https://graph.instagram.com/${metaVersion()}/me/permissions`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Instagram token revocation returned ${response.status}.`);
  }
}
