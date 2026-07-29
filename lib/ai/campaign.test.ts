import { describe, expect, it } from "vitest";
import { campaignSystemPrompt, generatedCampaignSchemaFor, normalizeGeneratedHashtags } from "@/lib/ai/campaign";

describe("campaign hashtags", () => {
  it("normalizes, deduplicates, and limits platform hashtags", () => {
    expect(normalizeGeneratedHashtags("linkedin", ["Product Marketing", "#BuildInPublic", "#BuildInPublic", "AI-tools!"]))
      .toEqual(["#ProductMarketing", "#BuildInPublic", "#AItools"]);
    expect(normalizeGeneratedHashtags("x", ["#One", "#Two", "#Three"]))
      .toEqual(["#One", "#Two"]);
  });
});

describe("campaign product-truth guardrails", () => {
  it("forbids invented hardware and unsupported assumptions", () => {
    expect(campaignSystemPrompt).toContain("Never fill missing context with a plausible assumption");
    expect(campaignSystemPrompt).toContain("Never turn a software product into hardware");
    expect(campaignSystemPrompt).toContain("ground every concept in a verified user action");
  });
});

describe("campaign response contract", () => {
  const post = (platform: "instagram" | "linkedin") => ({
    platform,
    pillar: "makeover" as const,
    hook: "A useful hook",
    body: "A practical product-grounded post.",
    cta: "Try it free",
    hashtags: ["#WorkplaceWriting", "#ClearCommunication"],
    dayOffset: 0,
    hourLocal: 10,
    mediaType: "image" as const,
    mediaBrief: "Show the verified workflow clearly.",
    mediaFrames: [],
    durationSeconds: 4 as const,
  });

  it("accepts only selected platforms and requires a complete weekly campaign", () => {
    const schema = generatedCampaignSchemaFor(["instagram"]);
    const base = { name: "Launch week", thesis: "Show the workflow", audience: "Workplace writers" };
    expect(schema.safeParse({ ...base, posts: Array.from({ length: 6 }, () => post("instagram")) }).success).toBe(true);
    expect(schema.safeParse({ ...base, posts: [post("linkedin"), ...Array.from({ length: 5 }, () => post("instagram"))] }).success).toBe(false);
    expect(schema.safeParse({ ...base, posts: Array.from({ length: 5 }, () => post("instagram")) }).success).toBe(false);
  });
});
