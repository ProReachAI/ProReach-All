import { afterEach, describe, expect, it } from "vitest";
import { appOrigin, appUrl, LOCAL_APP_ORIGIN, PRODUCTION_APP_ORIGIN } from "./app-origin";

const originalVercelEnv = process.env.VERCEL_ENV;
const originalVercelUrl = process.env.VERCEL_URL;

afterEach(() => {
  if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = originalVercelEnv;
  if (originalVercelUrl === undefined) delete process.env.VERCEL_URL;
  else process.env.VERCEL_URL = originalVercelUrl;
});

describe("appOrigin", () => {
  it("uses localhost outside Vercel even when production services back the app", () => {
    delete process.env.VERCEL_ENV;
    expect(appOrigin()).toBe(LOCAL_APP_ORIGIN);
    expect(appUrl("/api/oauth/meta/callback").toString()).toBe(
      "http://localhost:3000/api/oauth/meta/callback",
    );
  });

  it("uses the canonical ProReach origin in Vercel production", () => {
    process.env.VERCEL_ENV = "production";
    expect(appOrigin()).toBe(PRODUCTION_APP_ORIGIN);
  });

  it("keeps Vercel previews on their preview host", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_URL = "proreach-git-feature.example.vercel.app";
    expect(appOrigin()).toBe("https://proreach-git-feature.example.vercel.app");
  });
});
