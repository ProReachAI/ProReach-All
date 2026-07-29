import { afterEach, describe, expect, it, vi } from "vitest";
import { generatePremiumBackground, generateStructuredText } from "@/lib/ai/cloudflare";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Cloudflare Workers AI client", () => {
  it("requests native JSON schema output and returns the structured response", async () => {
    vi.stubEnv("AI_PROVIDER", "cloudflare");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "account-123");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "secret-token");
    vi.stubEnv("CLOUDFLARE_TEXT_MODEL", "@cf/meta/test-model");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      success: true,
      result: { response: { title: "A useful campaign" } },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const schema = {
      type: "object",
      properties: { title: { type: "string" } },
      required: ["title"],
    };
    const result = await generateStructuredText({
      messages: [{ role: "user", content: "Create a campaign" }],
      schema,
    });

    expect(result).toEqual({ title: "A useful campaign" });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/accounts/account-123/ai/run/@cf/meta/test-model");
    expect(request.headers).toMatchObject({ Authorization: "Bearer secret-token" });
    expect(JSON.parse(String(request.body))).toMatchObject({
      response_format: { type: "json_schema", json_schema: schema },
    });
  });

  it("classifies Cloudflare allowance failures as quota errors", async () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "account-123");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "secret-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      success: false,
      errors: [{ code: 1000, message: "Daily neuron allowance exceeded" }],
    }, 429)));

    await expect(generateStructuredText({
      messages: [{ role: "user", content: "test" }],
      schema: { type: "object" },
    })).rejects.toMatchObject({
      name: "CloudflareAIError",
      status: 429,
      quotaExceeded: true,
    });
  });

  it("turns provider timeouts into a safe, actionable error", async () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "account-123");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "secret-token");
    const timeout = new Error("The operation was aborted due to timeout");
    timeout.name = "TimeoutError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeout));

    await expect(generateStructuredText({
      messages: [{ role: "user", content: "test" }],
      schema: { type: "object" },
    })).rejects.toMatchObject({
      name: "CloudflareAIError",
      status: 504,
      message: expect.stringContaining("too long"),
    });
  });

  it("turns provider network failures into a safe, actionable error", async () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "account-123");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "secret-token");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(generateStructuredText({
      messages: [{ role: "user", content: "test" }],
      schema: { type: "object" },
    })).rejects.toMatchObject({
      name: "CloudflareAIError",
      status: 502,
      message: expect.stringContaining("could not reach"),
    });
  });

  it("retries a failed primary text model with the configured fallback", async () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "account-123");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "secret-token");
    vi.stubEnv("CLOUDFLARE_TEXT_MODEL", "@cf/meta/primary-model");
    vi.stubEnv("CLOUDFLARE_TEXT_FALLBACK_MODEL", "@cf/meta/fallback-model");
    const timeout = new Error("The operation was aborted due to timeout");
    timeout.name = "TimeoutError";
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(timeout)
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        result: { response: { title: "Fallback campaign" } },
      }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(generateStructuredText({
      messages: [{ role: "user", content: "Create a campaign" }],
      schema: { type: "object" },
    })).resolves.toEqual({ title: "Fallback campaign" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/primary-model");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/fallback-model");
  });

  it("uses FLUX.2 multipart generation with portrait feed dimensions", async () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "account-123");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "secret-token");
    vi.stubEnv("CLOUDFLARE_IMAGE_MODEL", "@cf/black-forest-labs/flux-2-klein-4b");
    const bytes = Buffer.from("premium-background");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      success: true,
      result: { image: bytes.toString("base64") },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(generatePremiumBackground("Premium campaign scene")).resolves.toEqual(bytes);
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const form = request.body as FormData;
    expect(url).toContain("/ai/run/@cf/black-forest-labs/flux-2-klein-4b");
    expect(form.get("prompt")).toBe("Premium campaign scene");
    expect(form.get("width")).toBe("1024");
    expect(form.get("height")).toBe("1280");
    expect(form.get("guidance")).toBe("7.5");
  });
});
