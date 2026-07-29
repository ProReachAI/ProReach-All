import { z } from "zod";
import { generateStructuredText } from "@/lib/ai/cloudflare";
import type { PostImageContext } from "@/lib/db";

const styleKinds = ["product", "metaphor", "workflow", "system", "character"] as const;

export const creativeStyles = [
  { id: "product-ui-stage", kind: "product", cue: "a dramatic product-stage composition built from truthful blank UI regions, feature controls, and the recognizable product workflow" },
  { id: "product-outcome-hero", kind: "product", cue: "one bold product outcome shown as the unmistakable hero, with supporting feature tokens and premium depth" },
  { id: "before-after-contrast", kind: "workflow", cue: "a striking split transformation showing the customer's specific before-state and product-enabled after-state" },
  { id: "three-beat-workflow", kind: "workflow", cue: "three visually distinct product steps connected in one fast, immediately readable flow" },
  { id: "feature-orbit-system", kind: "system", cue: "a central product engine with a small orbit of real features or outcomes, never unrelated technology symbols" },
  { id: "toolkit-grid", kind: "system", cue: "a bold modular grid of product capabilities with one dominant promise and tight visual hierarchy" },
  { id: "cinematic-3d-symbol", kind: "metaphor", cue: "a premium 3D symbol that directly represents the product mechanism, staged cinematically with high contrast" },
  { id: "signal-vs-noise", kind: "metaphor", cue: "a literal, instantly readable reduction from confusing signals into one clear actionable output" },
  { id: "faceless-character-story", kind: "character", cue: "a stylized 3D or illustrated faceless character interacting with the product outcome; never photoreal or anatomically uncanny" },
  { id: "kinetic-type-world", kind: "system", cue: "a graphic campaign world where large exact application-rendered typography and simple product shapes create the scroll stop" },
] as const;

export const CreativeDirectionSchema = z.object({
  styleId: z.string().min(2).max(50),
  sceneType: z.enum(styleKinds),
  adAngle: z.enum(["pain", "outcome", "mechanism", "comparison", "proof"]),
  conceptTitle: z.string().min(3).max(90),
  scrollStop: z.string().min(10).max(260),
  productConnection: z.string().min(25).max(500),
  productMechanism: z.string().min(20).max(360),
  viewerTakeaway: z.string().min(15).max(260),
  visualMetaphor: z.string().min(20).max(500),
  heroObject: z.string().min(10).max(350),
  abstractLayer: z.string().min(5).max(300),
  overlayMotif: z.enum(["message-transformation", "guided-steps", "evidence", "conversation", "none"]),
  environment: z.string().min(10).max(300),
  composition: z.string().min(10).max(300),
  materials: z.string().min(10).max(250),
  lighting: z.string().min(10).max(250),
  palette: z.string().min(10).max(180),
  mood: z.string().min(5).max(140),
  textPlacement: z.enum(["top-left", "top-center", "left", "upper-half"]),
  backgroundTone: z.enum(["dark", "light", "vibrant"]),
});

export type CreativeDirection = z.infer<typeof CreativeDirectionSchema>;

const pillarOutcome: Record<PostImageContext["pillar"], string> = {
  makeover: "show the customer's specific before-state changing into the product-enabled outcome",
  insight: "make the post's core product or customer insight visible through one direct structural idea",
  building: "show the real product workflow, shipped capability, or build process without inventing UI",
  proof: "make one verified capability or transformation result visually undeniable without fabricated numbers",
};

const pillarMotif: Record<PostImageContext["pillar"], CreativeDirection["overlayMotif"]> = {
  makeover: "message-transformation",
  insight: "conversation",
  building: "guided-steps",
  proof: "evidence",
};

const pillarKinds: Record<PostImageContext["pillar"], Array<(typeof styleKinds)[number]>> = {
  makeover: ["workflow", "product", "character"],
  insight: ["metaphor", "system", "character"],
  building: ["product", "workflow", "system"],
  proof: ["product", "workflow", "system", "metaphor"],
};

function clean(value: string | null | undefined, maximum: number) {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function backgroundSafe(value: string | null | undefined, projectName: string, maximum: number) {
  const brandTokens = projectName
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 4)
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const brandPattern = brandTokens.length ? new RegExp(`\\b(?:${brandTokens.join("|")})\\b`, "gi") : undefined;
  return clean(value, maximum).replace(brandPattern ?? /$^/, "the product");
}

function sceneSafe(value: string | null | undefined, projectName: string, maximum: number) {
  return backgroundSafe(value, projectName, maximum).replace(
    /\b(?:calendar|document|printed paper|paper|notebook|book|sign|poster|whiteboard|packaging|badge|screen|monitor|computer|laptop|phone|tablet|interface|keyboard|display|device|gadget|wearable|hardware|machine|robot|sensor|appliance|person|people|man|woman|face|portrait|human|employee|worker)\b/gi,
    "abstract software workflow element",
  );
}

export function isSoftwareOnlyProduct(context: Pick<PostImageContext, "projectName" | "oneLiner" | "description" | "solution" | "useCases" | "keyFeatures" | "additionalContext">) {
  const truth = [context.projectName, context.oneLiner, context.description, context.solution, context.useCases, ...context.keyFeatures, context.additionalContext].join(" ").toLowerCase();
  if (/software[- ]only|complete software|no hardware|not (?:a )?hardware|purely digital/.test(truth)) return true;
  const namesSoftware = /\b(software|saas|app|application|platform|website|browser|digital tool|communication tool|writing tool|assistant|rewrit(?:e|es|ing))\b/.test(truth);
  const namesHardware = /\b(hardware|device|sensor|wearable|appliance|physical product|robotics)\b/.test(truth);
  return namesSoftware && !namesHardware;
}

function choose<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function candidateStyles(recentStyleIds: string[], softwareOnly: boolean) {
  const eligible = softwareOnly
    ? creativeStyles.filter((style) => !["cinematic-3d-symbol", "faceless-character-story"].includes(style.id))
    : creativeStyles;
  return styleKinds.flatMap((kind) => {
    const all = eligible.filter((style) => style.kind === kind);
    const unused = all.filter((style) => !recentStyleIds.includes(style.id));
    const selected = choose(unused.length ? unused : all);
    return selected ? [selected] : [];
  });
}

function fallbackDirection(style: (typeof creativeStyles)[number], context: PostImageContext): CreativeDirection {
  const softwareOnly = isSoftwareOnlyProduct(context);
  return {
    styleId: style.id,
    sceneType: style.kind,
    adAngle: context.pillar === "proof" ? "proof" : context.pillar === "makeover" ? "comparison" : "mechanism",
    conceptTitle: "The product mechanism, made visible",
    scrollStop: `One oversized visual demonstrates ${clean(context.oneLiner, 150)} without requiring the caption.`,
    productConnection: clean(context.solution, 420),
    productMechanism: clean(context.solution, 320),
    viewerTakeaway: clean(context.oneLiner, 220),
    visualMetaphor: pillarOutcome[context.pillar],
    heroObject: softwareOnly
      ? `A text-free software workflow transformation grounded in this verified feature: ${clean(context.keyFeatures[0] || context.solution, 220)}.`
      : `One oversized product mechanism based on: ${clean(context.keyFeatures[0] || context.oneLiner, 220)}.`,
    abstractLayer: `Two or three restrained support elements derived only from these real capabilities: ${context.keyFeatures.slice(0, 3).map((item) => clean(item, 70)).join("; ")}.`,
    overlayMotif: pillarMotif[context.pillar],
    environment: softwareOnly
      ? "Abstract editorial communication canvas built from message blocks, tone states, and workflow relationships; no physical product or device."
      : "Purpose-built campaign studio with strong depth, controlled negative space, and no generic office scenery.",
    composition: "Visual focus in center-right, clear contrast, ample empty margin space on top and left.",
    materials: softwareOnly ? "Flat editorial color, translucent message panels, soft gradients, and clean geometric structure." : "Frosted glass, matte paper textures, sleek metallic accents, clean geometric forms.",
    lighting: "Soft ambient studio lighting with warm highlights and subtle focal depth.",
    palette: "Sophisticated neutral palette with one brand-aligned focal color accent.",
    mood: "Focused, elegant, precise, modern, and trustworthy.",
    textPlacement: style.id === "product-outcome-hero" || style.id === "feature-orbit-system" ? "top-center" : "top-left",
    backgroundTone: context.pillar === "building" || context.pillar === "proof" ? "dark" : "vibrant",
  };
}

export async function createCreativeDirection(context: PostImageContext, recentStyleIds: string[]) {
  const softwareOnly = isSoftwareOnlyProduct(context);
  const candidates = candidateStyles(recentStyleIds, softwareOnly);
  const fallbackPool = candidates.filter((style) => pillarKinds[context.pillar].includes(style.kind));
  const fallback = fallbackDirection(choose(fallbackPool), context);

  try {
    const response = await generateStructuredText({
      schema: z.toJSONSchema(CreativeDirectionSchema) as Record<string, unknown>,
      maxTokens: 1_600,
      timeoutMs: 30_000,
      messages: [
        {
          role: "system",
          content: `You are an elite product-ad creative director. Build original, scroll-stopping campaign concepts with the clarity of a high-performing technology advertisement, never a generic AI illustration.

NON-NEGOTIABLE
- No real humans, real faces, portraits, skin, hands, stock photography, celebrity likenesses, or photoreal people.
- A stylized faceless 3D/illustrated character is allowed only when it makes the product situation clearer.
- The product must be understood in three seconds: show its real input, mechanism, feature, workflow, or outcome.
- Never decorate with unrelated robots, brains, circuit boards, glowing AI letters, random threads, floating cubes, or vague futuristic scenery.
- Do not invent product UI, metrics, integrations, testimonials, logos, or capabilities.
- The saved product truth determines product modality. For a software-only product, never create or imply hardware, a device, gadget, wearable, robot, machine, physical casing, sensor, accessory, or packaging. Show only its verified software workflow, user action, transformation, or outcome.
- Choose one dominant visual idea. Use a strong hierarchy: promise, product mechanism, CTA. The application adds exact words and the real logo later.
- Make each concept materially different from recent styles. Return only structured direction.`,
        },
        {
          role: "user",
          content: `SAVED PRODUCT TRUTH
Product: ${clean(context.projectName, 80)}
Promise: ${clean(context.oneLiner, 220)}
What it does: ${clean(context.description, 520)}
Problem: ${clean(context.problemStatement, 380)}
Solution: ${clean(context.solution, 420)}
Target user: ${clean(context.targetAudience, 320)}
Pain points: ${clean(context.audiencePainPoints, 340)}
Use cases: ${clean(context.useCases, 420)}
Key features: ${context.keyFeatures.slice(0, 8).map((f) => clean(f, 90)).join("; ")}
Differentiators: ${clean(context.differentiators, 420)}
Verified proof: ${clean(context.proofPoints, 360)}
Additional verified boundaries: ${clean(context.additionalContext, 420) || "None"}

POST CONTEXT
Hook: ${clean(context.hook, 240)}
Body: ${clean(context.body, 700)}
CTA: ${clean(context.cta, 120)}
Media brief: ${clean(context.mediaBrief, 350) || "Not supplied"}
Pillar: ${context.pillar}

Choose style:
${candidates.map((style) => `- ${style.id} (${style.kind}): ${style.cue}`).join("\n")}
Avoid recent: ${recentStyleIds.join(", ") || "none"}.

Design the visual so a cold viewer can answer both “what problem is this?” and “what does the product change?” without reading the caption. Every visible element must trace to the saved product truth. Name the visible product mechanism, not an abstract mood. Never use real humans.${softwareOnly ? " This is software only: use message transformation, tone selection, conversation structure, or another verified digital workflow; no physical product or hardware." : ""}`,
        },
      ],
    });
    const validation = CreativeDirectionSchema.safeParse(response);
    const selectedStyle = validation.success ? candidates.find((style) => style.id === validation.data.styleId) : undefined;
    if (!validation.success || !selectedStyle || !pillarKinds[context.pillar].includes(selectedStyle.kind)) return fallback;
    const generatedScene = [validation.data.heroObject, validation.data.abstractLayer, validation.data.environment].join(" ");
    if (/\b(real person|real people|man|woman|face|portrait|human|employee|worker|hand|hands|skin|photoreal person)\b/i.test(generatedScene)) return fallback;
    if (softwareOnly && /\b(hardware|device|gadget|wearable|robot|machine|sensor|physical product|product casing|appliance|packaging)\b/i.test(generatedScene)) return fallback;
    return {
      ...validation.data,
      overlayMotif: validation.data.overlayMotif === "none" ? pillarMotif[context.pillar] : validation.data.overlayMotif,
    };
  } catch (error) {
    console.warn("Creative direction generation fallback used:", error instanceof Error ? error.message : "Unknown error");
    return fallback;
  }
}

export function premiumVisualPrompt(context: PostImageContext, direction: CreativeDirection) {
  const softwareOnly = isSoftwareOnlyProduct(context);
  const textZone = {
    "top-left": "Keep the upper-left 48% calm and low-detail for exact headline typography; place the hero lower-right.",
    "top-center": "Keep the top 38% calm and low-detail for centered headline typography; stage the hero in the lower half.",
    left: "Keep the left 46% calm and low-detail for exact typography; place the product story on the right.",
    "upper-half": "Keep the upper 43% calm and low-detail for exact typography; build the product scene across the lower half.",
  }[direction.textPlacement];
  const characterRule = direction.sceneType === "character"
    ? "Allow one charming stylized faceless 3D or illustrated character with simplified toy-like anatomy. It must not look photographic and must have no realistic face or skin."
    : "No people, bodies, faces, portraits, skin or hands. Do not add a character.";

  return `Create an original premium technology product-ad background. It must communicate a real product mechanism in three seconds, not look like generic AI art.

ABSOLUTE RULES
${characterRule}
No readable text, letters, numbers, logos, brand marks, fake UI copy, fake metrics or watermarks. Do not render the company name. No generic robots, brains, circuit boards, glowing “AI” symbols, random rope/thread, floating cubes or meaningless futuristic decoration. Do not invent features or integrations.
${softwareOnly ? "SOFTWARE-ONLY PRODUCT: Do not show or imply hardware, a device, gadget, wearable, robot, machine, sensor, physical product casing, packaging, or accessory. Build the scene only from verified software actions and outcomes: message transformation, tone choice, conversation structure, or workflow states. Do not fabricate a screenshot or UI." : "Never depict hardware unless it is explicitly verified in the saved product truth."}

VERIFIED PRODUCT ANCHOR
Outcome: ${backgroundSafe(context.oneLiner, context.projectName, 130)}
Real workflow: ${backgroundSafe(context.solution, context.projectName, 190)}
Verified capabilities: ${context.keyFeatures.slice(0, 4).map((feature) => backgroundSafe(feature, context.projectName, 65)).join("; ")}
This post's visual job: ${backgroundSafe(context.mediaBrief || context.hook, context.projectName, 150)}
Every visible object must directly express this workflow, capability, or outcome.

COMPOSITION
Portrait 4:5. ${textZone} ${clean(direction.composition, 85)} Brand and exact English copy are added later by the application.

AD CONCEPT
Archetype: ${direction.styleId}. Concept: ${clean(direction.conceptTitle, 65)}. Angle: ${direction.adAngle}. Tone: ${direction.backgroundTone}.
Scroll stop: ${backgroundSafe(direction.scrollStop, context.projectName, 145)}
Product connection: ${backgroundSafe(direction.productConnection, context.projectName, 150)}
Product mechanism: ${backgroundSafe(direction.productMechanism, context.projectName, 180)}
Viewer understands: ${backgroundSafe(direction.viewerTakeaway, context.projectName, 120)}
Visible concept: ${sceneSafe(direction.visualMetaphor, context.projectName, 130)}
Hero: ${sceneSafe(direction.heroObject, context.projectName, 110)}
Support: ${sceneSafe(direction.abstractLayer, context.projectName, 80)}

ART DIRECTION
${sceneSafe(direction.environment, context.projectName, 85)}. ${sceneSafe(direction.materials, context.projectName, 65)}. ${clean(direction.lighting, 70)}. ${clean(direction.palette, 60)}. Bold hierarchy, premium campaign finish, crisp silhouette, intentional depth, no visual clutter. Output only the clean background scene.`.slice(0, 2_048);
}
