import { describe, expect, it } from "vitest";
import { ProjectInputSchema } from "@/lib/projects";

const valid = {
  name: "Prophrase",
  websiteUrl: "https://example.com",
  oneLiner: "A clear description of what the product helps people accomplish.",
  description: "A sufficiently detailed and truthful explanation of how the product works for its intended customer.",
  problemStatement: "Customers lose time and confidence while trying to complete an important task.",
  solution: "The product provides a focused workflow that helps them complete that task with less friction.",
  targetAudience: "Independent professionals and small teams with a recurring need for this workflow.",
  audiencePainPoints: "They currently repeat manual work, second-guess decisions, and struggle to stay consistent.",
  useCases: "A practical daily use case.",
  keyFeatures: ["Focused workflow"],
  differentiators: "The product stays narrow, preserves user control, and does not invent unsupported outcomes.",
  proofPoints: "Only verified product capabilities are used as proof.",
  competitors: "Manual workflow",
  brandVoice: "Direct, observant, useful, and human.",
  toneGuidelines: "Prefer concrete examples.",
  wordsToUse: ["clear"],
  wordsToAvoid: ["revolutionary"],
  primaryGoal: "Help qualified customers understand the product and try the core workflow.",
  primaryCta: "Try the core workflow.",
  additionalContext: "Early-stage product.",
};

describe("ProjectInputSchema", () => {
  it("accepts complete product context", () => {
    expect(ProjectInputSchema.parse(valid).keyFeatures).toEqual(["Focused workflow"]);
  });

  it("rejects incomplete context", () => {
    expect(() => ProjectInputSchema.parse({ ...valid, proofPoints: "" })).toThrow();
  });
});
