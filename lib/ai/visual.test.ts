import { describe, expect, it } from "vitest";
import { premiumVisualPrompt, type CreativeDirection } from "@/lib/ai/visual";
import type { PostImageContext } from "@/lib/db";

const context: PostImageContext = {
  postId: "post-id",
  projectId: "project-id",
  projectName: "ProPhrase AI",
  oneLiner: "Turn rough thoughts into clear workplace messages.",
  description: "A communication assistant that rewrites rough messages while preserving intent.",
  problemStatement: "Professionals know what to say but struggle to find clear wording for sensitive workplace messages.",
  solution: "Users paste a rough message, select a tone and receive a clearer ready-to-send version.",
  targetAudience: "Working professionals, managers, founders and customer-facing teams.",
  audiencePainPoints: "Uncertainty about tone, sounding rude and spending too much time rewriting short messages.",
  useCases: "Deadline extensions, client follow-ups, feedback, apologies and boundary setting.",
  keyFeatures: ["Tone-based rewriting", "Outcome-focused messages"],
  differentiators: "Designed specifically for real workplace communication without complex prompting.",
  proofPoints: "Users can rewrite a rough message by selecting a tone.",
  additionalContext: "ProPhrase is complete software only and has no hardware component.",
  brandVoice: "Direct, calm and trustworthy.",
  logoUrl: null,
  logoKey: null,
  platform: "linkedin",
  pillar: "makeover",
  hook: "Say what you mean. Send it how you mean it.",
  body: "A rough message becomes a clear message.",
  cta: "Try ProPhrase free",
  mediaBrief: "Show a rough message card transforming into a refined message card.",
  mediaType: "image",
  mediaPlan: { frames: [], durationSeconds: 4 },
  mediaItems: [],
  mediaKey: null,
  visualStyle: null,
};

const direction: CreativeDirection = {
  styleId: "before-after-contrast",
  sceneType: "workflow",
  adAngle: "comparison",
  conceptTitle: "Input to clear outcome",
  scrollStop: "One rough message breaks into a calm and intentional final structure.",
  productConnection: "Visualizes how ProPhrase AI converts raw, unrefined text input into structured, clear workplace messaging.",
  productMechanism: "The product rewrites a rough workplace message according to the user's selected tone while preserving intent.",
  viewerTakeaway: "ProPhrase helps professionals find clear wording and the right tone.",
  visualMetaphor: "An unorganized message draft becoming clear, structured, and intentional.",
  heroObject: "Clean geometric message containers demonstrating transformation from fragmented to structured hierarchy.",
  abstractLayer: "Translucent glass-like message cards and structured flow paths with warm lighting.",
  overlayMotif: "message-transformation",
  environment: "Minimalist modern studio workspace background with zero clutter, macro depth, and soft lighting.",
  composition: "Visual focus in center-right, clear contrast, ample empty margin space on top and left.",
  materials: "Frosted glass, matte paper textures, sleek metallic accents, clean geometric forms.",
  lighting: "Soft ambient studio lighting with warm highlights and subtle focal depth.",
  palette: "Warm neutrals, muted blue and one restrained golden accent.",
  mood: "Focused, elegant, precise, modern, and trustworthy.",
  textPlacement: "top-left",
  backgroundTone: "vibrant",
};

describe("premiumVisualPrompt", () => {
  it("provides premium art direction and reserves clean space for exact typography without human faces", () => {
    const prompt = premiumVisualPrompt(context, direction);
    expect(prompt).toContain("Input to clear outcome");
    expect(prompt).toContain("before-after-contrast");
    expect(prompt).toContain("No people, bodies, faces");
    expect(prompt).toContain("upper-left 48%");
    expect(prompt).toContain("Product mechanism");
    expect(prompt).toContain("VERIFIED PRODUCT ANCHOR");
    expect(prompt).toContain("Users paste a rough message, select a tone");
    expect(prompt).toContain("Show a rough message card transforming into a refined message card");
    expect(prompt).toContain("No generic robots");
    expect(prompt).toContain("SOFTWARE-ONLY PRODUCT");
    expect(prompt).toContain("Do not show or imply hardware");
    expect(prompt).not.toContain("ProPhrase AI");
    expect(prompt.length).toBeLessThanOrEqual(2_048);
  });
});
