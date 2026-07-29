import { describe, expect, it } from "vitest";
import { canonicalOAuthStartUrl } from "./oauth-origin";

describe("canonicalOAuthStartUrl", () => {
  it("moves OAuth initiation from localhost to the configured public origin", () => {
    expect(canonicalOAuthStartUrl(
      "http://localhost:3000/api/oauth/meta?mode=organization",
      "https://buildtoreach.example",
    )?.toString()).toBe("https://buildtoreach.example/api/oauth/meta?mode=organization");
  });

  it("does not redirect a request already using the configured origin", () => {
    expect(canonicalOAuthStartUrl(
      "https://buildtoreach.example/api/oauth/meta",
      "https://buildtoreach.example",
    )).toBeUndefined();
  });

  it("trusts the browser-facing host supplied by an HTTPS reverse proxy", () => {
    expect(canonicalOAuthStartUrl(
      "http://localhost:3000/api/oauth/meta",
      "https://buildtoreach.example",
      "buildtoreach.example",
    )).toBeUndefined();
  });

  it("does not redirect when APP_URL is not configured", () => {
    expect(canonicalOAuthStartUrl("http://localhost:3000/api/oauth/meta")).toBeUndefined();
  });
});
