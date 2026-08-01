import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authorizationScopes, completeAuthorization, providerConfig } from "./providers";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

describe("OAuth provider completion", () => {
  beforeEach(() => {
    process.env.APP_URL = "https://buildtoreach.example";
    process.env.META_APP_ID = "meta-id";
    process.env.META_APP_SECRET = "meta-secret";
    process.env.META_GRAPH_VERSION = "v25.0";
    process.env.INSTAGRAM_APP_ID = "instagram-id";
    process.env.INSTAGRAM_APP_SECRET = "instagram-secret";
    process.env.X_CLIENT_ID = "x-id";
    process.env.X_CLIENT_SECRET = "x-secret";
    process.env.THREADS_CLIENT_ID = "threads-id";
    process.env.THREADS_CLIENT_SECRET = "threads-secret";
    process.env.LINKEDIN_CLIENT_ID = "linkedin-id";
    process.env.LINKEDIN_CLIENT_SECRET = "linkedin-secret";
    delete process.env.LINKEDIN_ORGANIZATION_ACCESS;
  });

  afterEach(() => vi.unstubAllGlobals());

  it("uses X PKCE and returns the authenticated publishing identity", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("oauth2/token")) {
        expect(String(init?.body)).toContain("code_verifier=verifier-123");
        expect(init?.headers).toMatchObject({ Authorization: expect.stringMatching(/^Basic /) });
        return json({ access_token: "x-access", refresh_token: "x-refresh", expires_in: 7200, scope: "tweet.read tweet.write users.read offline.access" });
      }
      if (url.includes("/2/users/me")) return json({ data: { id: "42", name: "Builder", username: "builder" } });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await completeAuthorization("x", "auth-code", "verifier-123");
    expect(result.providerUserId).toBe("42");
    expect(result.token.refreshToken).toBe("x-refresh");
    expect(result.accounts).toEqual([expect.objectContaining({ platform: "x", providerAccountId: "42" })]);
  });

  it("exchanges a Threads code for a long-lived token", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/oauth/access_token")) return json({ access_token: "threads-short", expires_in: 3600 });
      if (url.includes("/access_token?") && url.includes("th_exchange_token")) return json({ access_token: "threads-long", expires_in: 5_184_000 });
      if (url.includes("/v1.0/me")) return json({ id: "84", username: "maker", name: "Maker" });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await completeAuthorization("threads", "auth-code");
    expect(result.token.accessToken).toBe("threads-long");
    expect(result.accounts[0]).toMatchObject({ platform: "threads", providerAccountId: "84" });
  });

  it("discovers Facebook Pages without requiring an Instagram link", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("oauth/access_token") && url.includes("fb_exchange_token")) return json({ access_token: "meta-long", expires_in: 5_184_000 });
      if (url.includes("oauth/access_token")) return json({ access_token: "meta-short", expires_in: 3600 });
      if (url.includes("/me?fields=id,name")) return json({ id: "meta-user", name: "Owner" });
      if (url.includes("/me/accounts")) return json({
        data: [{
          id: "page-1",
          name: "Prophrase",
          access_token: "page-token",
          tasks: ["PROFILE_PLUS_CREATE_CONTENT"],
        }],
      });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await completeAuthorization("meta", "auth-code");
    expect(result.token.accessToken).toBe("meta-long");
    expect(result.accounts).toEqual([
      expect.objectContaining({ platform: "facebook", providerAccountId: "page-1", accessToken: "page-token" }),
    ]);
  });

  it("connects an Instagram professional account directly without a Facebook Page", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://api.instagram.com/oauth/access_token") {
        expect(String(init?.body)).toContain("client_id=instagram-id");
        expect(String(init?.body)).toContain("code=auth-code");
        return json({ access_token: "ig-short", user_id: "ig-user" });
      }
      if (url.includes("graph.instagram.com/access_token")) {
        expect(url).toContain("ig_exchange_token");
        return json({ access_token: "ig-long", expires_in: 5_184_000 });
      }
      if (url.includes("graph.instagram.com/v25.0/me")) {
        return json({ id: "ig-user", username: "prophraseai", name: "ProPhrase", profile_picture_url: "https://example.com/ig.jpg" });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await completeAuthorization("instagram", "auth-code");
    expect(result.token.accessToken).toBe("ig-long");
    expect(result.accounts).toEqual([expect.objectContaining({
      platform: "instagram",
      providerAccountId: "ig-user",
      accessToken: "ig-long",
      metadata: expect.objectContaining({ username: "prophraseai", graphHost: "graph.instagram.com" }),
    })]);
  });

  it("uses LinkedIn OIDC identity for the member publishing account", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("oauth/v2/accessToken")) return json({ access_token: "li-access", expires_in: 5_184_000, scope: "openid profile w_member_social" });
      if (url.includes("/v2/userinfo")) return json({ sub: "li-person", name: "Naga Pavan", picture: "https://example.com/pic.jpg" });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await completeAuthorization("linkedin", "auth-code");
    expect(result.displayName).toBe("Naga Pavan");
    expect(result.accounts[0]).toMatchObject({ platform: "linkedin", providerAccountId: "li-person" });
  });

  it("requests only self-service LinkedIn permissions by default", () => {
    expect(providerConfig.linkedin.scopes).toEqual(["openid", "profile", "w_member_social"]);
    expect(authorizationScopes("linkedin")).toEqual(["openid", "profile", "w_member_social"]);
  });

  it("requests restricted LinkedIn organization permissions only after explicit enablement", () => {
    process.env.LINKEDIN_ORGANIZATION_ACCESS = "true";
    expect(authorizationScopes("linkedin")).toEqual([
      "openid",
      "profile",
      "w_member_social",
      "rw_organization_admin",
      "w_organization_social",
    ]);
  });

  it("discovers administered LinkedIn company Pages as explicit publishing destinations", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("oauth/v2/accessToken")) return json({
        access_token: "li-access",
        expires_in: 5_184_000,
        scope: "openid profile w_member_social rw_organization_admin w_organization_social",
      });
      if (url.includes("/v2/userinfo")) return json({ sub: "li-person", name: "Naga Pavan" });
      if (url.includes("/rest/organizationAcls")) return json({
        elements: [{ role: "ADMINISTRATOR", organization: "urn:li:organization:12345", state: "APPROVED" }],
      });
      if (url.includes("/rest/organizations/12345")) return json({ id: 12345, localizedName: "ProPhrase AI", vanityName: "prophrase-ai" });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await completeAuthorization("linkedin", "auth-code");
    expect(result.accounts).toEqual([
      expect.objectContaining({ providerAccountId: "li-person", metadata: expect.objectContaining({ destinationType: "person" }) }),
      expect.objectContaining({
        providerAccountId: "12345",
        displayName: "ProPhrase AI",
        metadata: expect.objectContaining({ destinationType: "organization", authorUrn: "urn:li:organization:12345" }),
      }),
    ]);
  });
});
