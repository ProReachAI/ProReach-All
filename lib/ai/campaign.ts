import { z } from "zod";
import { CloudflareAIError, generateStructuredText } from "@/lib/ai/cloudflare";
import { mediaTypes, platforms, type Campaign, type ContentPillar, type MediaFrame, type MediaType, type Platform, type ProductProject } from "@/lib/types";

export const CampaignRequestSchema = z.object({
  projectId: z.string().uuid(),
  goal: z.string().trim().min(10).max(1000),
  focus: z.string().trim().max(1000).default(""),
  instructions: z.string().trim().max(1500).default(""),
  platforms: z.array(z.enum(platforms)).min(1).max(platforms.length),
});

const GeneratedPostSchema = z.object({
    platform: z.enum(platforms),
    pillar: z.enum(["makeover", "insight", "building", "proof"]),
    hook: z.string(),
    body: z.string(),
    cta: z.string(),
    hashtags: z.array(z.string()).min(2).max(8),
    dayOffset: z.number().int().min(0).max(6),
    hourLocal: z.number().int().min(7).max(21),
    mediaType: z.enum(mediaTypes),
    mediaBrief: z.string().nullable(),
    mediaFrames: z.array(z.object({
      headline: z.string().max(90),
      supportingText: z.string().max(180),
    })).max(5),
    durationSeconds: z.union([z.literal(3), z.literal(4), z.literal(5)]),
});

const GeneratedCampaignFieldsSchema = z.object({
  name: z.string(),
  thesis: z.string(),
  audience: z.string(),
});

export function generatedCampaignSchemaFor(requestedPlatforms: readonly Platform[]) {
  const [first, ...rest] = requestedPlatforms;
  if (!first) throw new CloudflareAIError("Choose at least one platform before generating.", 400);
  const RequestedPlatformSchema = z.enum([first, ...rest] as [Platform, ...Platform[]]);
  return GeneratedCampaignFieldsSchema.extend({
    posts: z.array(GeneratedPostSchema.extend({ platform: RequestedPlatformSchema })).length(6),
  });
}

export type CampaignRequest = z.infer<typeof CampaignRequestSchema>;

export const campaignSystemPrompt = `Role: You are a product marketing strategist for an honest indie software company.

Goal: Turn a persistent, verified product context into a seven-day social campaign that earns qualified attention.

Success criteria:
- Create exactly 6 posts distributed only across the requested platforms. Six focused drafts are better than a longer, repetitive response.
- Adapt every post to the native platform; do not duplicate copy.
- Give all 6 posts distinct concepts, hooks, bodies, and CTAs. Never repeat a sentence or recycle the same feature/use-case angle in multiple posts.
- Use concrete moments, demonstrations, useful teaching, and founder insight.
- Give every post one job and one natural CTA.
- Keep the body separate from the hook and CTA. Do not repeat the CTA inside the body.
- Generate 3 to 6 specific, relevant hashtags for every post. Use 1 or 2 for X so the complete post remains within 280 characters. Return each hashtag with a leading #, use English words, and never invent branded trends.
- Allocate pillars close to 40% makeover, 25% insight, 20% building, 15% proof.

Constraints:
- Treat SAVED PRODUCT TRUTH as the authoritative specification. Use only facts present there; campaign goal, focus, and additional instructions may choose emphasis but may not add product facts.
- Never fill missing context with a plausible assumption. If a requested angle is unsupported, choose the closest verified product capability or customer problem instead.
- Never invent users, testimonials, metrics, awards, urgency, or product capabilities.
- Never turn a software product into hardware. Do not describe or request devices, gadgets, wearables, robots, machines, physical product casings, packaging, sensors, accessories, or invented physical mechanisms unless the saved product truth explicitly says the product includes hardware.
- For software-only products, ground every concept in a verified user action, software workflow, feature, use case, message transformation, or outcome from the saved product truth.
- Do not use engagement bait, fake controversy, hype, or generic AI vocabulary.
- Every Facebook, Instagram, and LinkedIn post should include a specific, product-grounded media brief and media type.
- Build a deliberate mixed-format campaign: roughly 35% single images, 35% carousels, and 30% short motion clips when the requested platforms support them. Never make every post the same format.
- Choose carousels for frameworks, comparisons, checklists, transformations, and step-by-step education. Supply 4 or 5 concise mediaFrames whose text is factually grounded and understandable in sequence.
- Choose motion for a single transformation, reveal, workflow or emotional shift that can loop in 3 to 5 seconds. Supply exactly 3 concise mediaFrames: opening state, transition, outcome.
- Choose images for one arresting visual idea or human story moment. Supply no mediaFrames.
- Motion is currently supported only for LinkedIn and Facebook. Use image or carousel for Instagram. Use image for X and Threads.
- Treat every media brief as a product advertisement, not a decorative illustration. Identify the customer's exact tension, the visible product mechanism, the recognizable outcome, and the single scroll-stopping hero idea.
- Use one of these varied concept families when relevant: product workflow stage, before/after contrast, three-beat workflow, feature system, toolkit grid, signal-versus-noise, or kinetic typography world.
- Never request real people, realistic faces, portraits, skin, hands, workplace stock photography, or celebrity likenesses. A clearly illustrated or toy-like faceless character is allowed only when it clarifies the use case.
- Do not use generic robots, brains, glowing AI letters, circuit-board backgrounds, random threads, floating cubes, vague futuristic rooms, or an abstract object whose relationship to the product is unclear.
- The visual must pass a three-second test: a new viewer should recognize both the problem and what the product changes before reading the caption.
- Do not request poster text, generated logos, readable screens, invented UI, fake testimonials, unverified metrics, unsupported integrations, or third-party trademarks. Exact copy and the uploaded logo are composited by the application.
- Keep X posts compact enough for a standard post unless the body explicitly reads as a short thread.
- The writing should feel direct, observant, useful, and human.

Output only the requested structured campaign.`;

function normalizedFrames(mediaType: MediaType, pillar: ContentPillar, generated: MediaFrame[], hook: string, body: string, cta: string): MediaFrame[] {
  const firstSentence = body.split(/(?<=[.!?])\s+/)[0]?.trim() || body.trim();
  if (mediaType === "image") return [];
  if (mediaType === "motion") {
    const fallback = [
      { headline: hook, supportingText: pillar === "building" ? "A concrete look at what the team is building." : "Start with the customer's real friction." },
      { headline: pillar === "building" ? "From work in progress to ready" : "See what the product changes", supportingText: firstSentence },
      { headline: pillar === "building" ? "The next release is taking shape" : "Move to the better outcome", supportingText: cta },
    ];
    return (generated.length >= 3 ? generated.slice(0, 3) : fallback).map((frame) => ({
      headline: frame.headline.slice(0, 90), supportingText: frame.supportingText.slice(0, 180),
    }));
  }
  const fallback = [
    { headline: hook, supportingText: "A practical guide for the moment this problem appears." },
    { headline: "Why it feels difficult", supportingText: firstSentence },
    { headline: "The product mechanism", supportingText: "Connect the real capability to the outcome it creates." },
    { headline: "Try the workflow", supportingText: cta },
  ];
  return (generated.length >= 4 ? generated.slice(0, 5) : fallback).map((frame) => ({
    headline: frame.headline.slice(0, 90), supportingText: frame.supportingText.slice(0, 180),
  }));
}

function supportedMediaType(platform: Platform, requested: MediaType): MediaType {
  if (platform === "x" || platform === "threads") return "image";
  if (platform === "instagram" && requested === "motion") return "carousel";
  return requested;
}

function ensureFormatVariety<T extends { platform: Platform; mediaType: MediaType; pillar: ContentPillar }>(posts: T[]) {
  const visual = posts.filter((post) => ["facebook", "instagram", "linkedin"].includes(post.platform));
  if (visual.length < 3) return posts;
  const present = new Set(visual.map((post) => post.mediaType));
  const missing = mediaTypes.filter((type) => !present.has(type));
  const reassigned = new Set<T>();
  for (const mediaType of missing) {
    const candidate = visual.find((post) => !reassigned.has(post) && (mediaType !== "motion" || post.platform !== "instagram"));
    if (candidate) { candidate.mediaType = mediaType; reassigned.add(candidate); }
  }
  return posts;
}

export function normalizeGeneratedHashtags(platform: Platform, values: string[]) {
  const maximum = platform === "x" ? 2 : 6;
  const normalized = values
    .map((value) => `#${value.replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "")}`)
    .filter((value) => value.length > 1 && value.length <= 50);
  return [...new Set(normalized)].slice(0, maximum);
}

function productContext(project: ProductProject) {
  return `PRODUCT TRUTH
Name: ${project.name}
Website: ${project.websiteUrl ?? "Not provided"}
One-line promise: ${project.oneLiner}
Description: ${project.description}
Problem: ${project.problemStatement}
Solution: ${project.solution}
Key features: ${project.keyFeatures.join("; ")}
Use cases: ${project.useCases || "Not provided"}

CUSTOMER
Target audience: ${project.targetAudience}
Pain points: ${project.audiencePainPoints}

POSITIONING AND EVIDENCE
Differentiators: ${project.differentiators}
Verified proof points: ${project.proofPoints}
Alternatives or competitors: ${project.competitors || "Not provided"}

VOICE AND GUARDRAILS
Brand voice: ${project.brandVoice}
Tone guidance: ${project.toneGuidelines || "Not provided"}
Preferred language: ${project.wordsToUse.join(", ") || "Not provided"}
Avoid: ${project.wordsToAvoid.join(", ") || "Not provided"}
Default marketing goal: ${project.primaryGoal}
Default CTA: ${project.primaryCta}
Additional verified context: ${project.additionalContext || "Not provided"}`;
}

export async function generateCampaign(project: ProductProject, brief: CampaignRequest): Promise<Campaign> {
  const responseSchema = generatedCampaignSchemaFor(brief.platforms);
  const generatedResponse = await generateStructuredText({
    schema: z.toJSONSchema(responseSchema) as Record<string, unknown>,
    maxTokens: 3_500,
    timeoutMs: 75_000,
    messages: [
      { role: "system", content: campaignSystemPrompt },
      {
        role: "user",
        content: `${productContext(project)}

CURRENT CAMPAIGN
Goal: ${brief.goal}
Focus or timely angle: ${brief.focus || "Use the strongest product and customer moments from the context."}
Requested platforms: ${brief.platforms.join(", ")}
Additional instructions: ${brief.instructions || "None"}

Use only requested platforms. Treat every saved product field and proof point as a strict factual boundary. First identify the exact verified feature, use case, pain point, or differentiator behind each post. If context is missing, do not fill the gap with an assumption.`,
      },
    ],
  });

  const validation = responseSchema.safeParse(generatedResponse);
  if (!validation.success) {
    throw new CloudflareAIError("The AI response was incomplete. Please generate the campaign again.", 502);
  }
  const parsed = validation.data;
  const requested = new Set<Platform>(brief.platforms);
  const generated = ensureFormatVariety(parsed.posts
    .filter((post) => requested.has(post.platform))
    .map((post) => ({ ...post, mediaType: supportedMediaType(post.platform, post.mediaType) })));
  if (generated.length < 6) {
    throw new CloudflareAIError("The AI did not return enough posts for the selected platforms. Please try again.", 502);
  }
  return {
    id: crypto.randomUUID(),
    projectId: project.id,
    name: parsed.name,
    thesis: parsed.thesis,
    audience: parsed.audience,
    posts: generated.map((post) => ({
      id: crypto.randomUUID(),
      platform: post.platform as Platform,
      pillar: post.pillar as ContentPillar,
      hook: post.hook,
      body: post.body,
      cta: post.cta,
      hashtags: normalizeGeneratedHashtags(post.platform, post.hashtags),
      status: "review",
      scheduledFor: null,
      mediaBrief: post.mediaBrief,
      mediaType: post.mediaType,
      mediaPlan: {
        frames: normalizedFrames(post.mediaType, post.pillar, post.mediaFrames, post.hook, post.body, post.cta),
        durationSeconds: post.durationSeconds,
      },
      mediaItems: [],
      mediaUrl: null,
      mediaKey: null,
    })),
  };
}
