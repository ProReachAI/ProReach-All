import { describe, expect, it, vi } from "vitest";
import {
  collectWebsiteContext,
  extractReadablePage,
  isPublicIpAddress,
  normalizeWebsiteUrl,
  WebsiteAnalysisError,
} from "@/lib/ai/project-profile";

const publicResolver = async () => [{ address: "93.184.216.34", family: 4 }];

function htmlResponse(html: string, status = 200, headers: Record<string, string> = {}) {
  return new Response(html, { status, headers: { "Content-Type": "text/html", ...headers } });
}

describe("website project profiling", () => {
  it("normalizes a bare domain and rejects credentialed or unsupported URLs", () => {
    expect(normalizeWebsiteUrl("example.com/product#demo").href).toBe("https://example.com/product");
    expect(() => normalizeWebsiteUrl("https://user:pass@example.com")).toThrow(WebsiteAnalysisError);
    expect(() => normalizeWebsiteUrl("file:///etc/passwd")).toThrow(WebsiteAnalysisError);
  });

  it("classifies private, reserved, and public addresses", () => {
    expect(isPublicIpAddress("127.0.0.1")).toBe(false);
    expect(isPublicIpAddress("10.0.0.8")).toBe(false);
    expect(isPublicIpAddress("169.254.169.254")).toBe(false);
    expect(isPublicIpAddress("::1")).toBe(false);
    expect(isPublicIpAddress("fc00::1")).toBe(false);
    expect(isPublicIpAddress("93.184.216.34")).toBe(true);
    expect(isPublicIpAddress("2606:4700:4700::1111")).toBe(true);
  });

  it("extracts useful metadata and visible copy without scripts", () => {
    const result = extractReadablePage(`
      <html><head><title>Acme &amp; Co</title><meta name="description" content="A focused workflow for teams"></head>
      <body><nav>Ignore navigation</nav><h1>Ship clear campaigns</h1><p>Plan, review, and publish from one place.</p>
      <script>stealSecrets()</script><a href="/features">Features</a></body></html>
    `, new URL("https://acme.test/"));
    expect(result.text).toContain("TITLE: Acme & Co");
    expect(result.text).toContain("A focused workflow for teams");
    expect(result.text).toContain("Ship clear campaigns");
    expect(result.text).not.toContain("stealSecrets");
    expect(result.links).toContain("/features");
  });

  it("collects the homepage and relevant same-origin product pages", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname === "/features") {
        return htmlResponse("<html><body><h1>Campaign approvals</h1><p>Review every draft before it is scheduled and keep the final decision with your team.</p></body></html>");
      }
      return htmlResponse(`<html><head><title>Acme</title></head><body>
        <h1>Turn product truth into useful campaigns</h1>
        <p>Acme helps small marketing teams plan, review, and publish consistent social content without losing editorial control.</p>
        <a href="/features">See features</a><a href="https://other.test/about">External</a>
      </body></html>`);
    });

    const result = await collectWebsiteContext("acme.test", { fetchImpl, resolveHostname: publicResolver });
    expect(result.websiteUrl).toBe("https://acme.test/");
    expect(result.pages).toEqual(["https://acme.test/", "https://acme.test/features"]);
    expect(result.context).toContain("Campaign approvals");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("blocks redirects to private network addresses", async () => {
    const fetchImpl = vi.fn(async () => htmlResponse("", 302, { Location: "http://127.0.0.1/admin" }));
    await expect(collectWebsiteContext("example.com", { fetchImpl, resolveHostname: publicResolver }))
      .rejects.toThrow("Private or internal website addresses cannot be analyzed");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});

