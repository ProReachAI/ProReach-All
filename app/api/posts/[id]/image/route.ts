import { NextResponse } from "next/server";
import { z } from "zod";
import { CloudflareAIError, generatePremiumBackground } from "@/lib/ai/cloudflare";
import { dailyAILimit } from "@/lib/ai/limits";
import { createCreativeDirection, premiumVisualPrompt } from "@/lib/ai/visual";
import {
  getPostImageContext,
  getRecentVisualStyles,
  hasDatabase,
  releaseAIUsage,
  reserveAIUsage,
  setPostMedia,
  type PostImageContext,
} from "@/lib/db";
import { renderCarouselSlides } from "@/lib/media/carousel";
import { renderMotionClip } from "@/lib/media/motion";
import { deleteGeneratedImage, downloadStoredImage, uploadGeneratedAsset } from "@/lib/media/r2";
import { renderSocialCard } from "@/lib/media/social-card";
import { mediaTypes, type MediaAsset, type MediaFrame, type MediaType } from "@/lib/types";

export const runtime = "nodejs";

const ParamsSchema = z.object({ id: z.string().uuid() });
const BodySchema = z.object({ mediaType: z.enum(mediaTypes).optional() });

function defaultFrames(mediaType: MediaType, pillar: PostImageContext["pillar"], hook: string, body: string, cta: string): MediaFrame[] {
  if (mediaType === "image") return [];
  const firstSentence = body.split(/(?<=[.!?])\s+/)[0]?.trim() || body.trim();
  if (mediaType === "motion") return [
    { headline: hook, supportingText: pillar === "building" ? "A concrete look at what the team is building." : pillar === "proof" ? "Start with the verified capability." : "Start with the customer's real friction." },
    { headline: pillar === "building" ? "From work in progress to ready" : pillar === "proof" ? "See the capability in action" : "See what the product changes", supportingText: firstSentence },
    { headline: pillar === "building" ? "The next release is taking shape" : "Move to the better outcome", supportingText: cta },
  ];
  return [
    { headline: hook, supportingText: "A practical guide grounded in the real product use case." },
    { headline: "Why this feels difficult", supportingText: firstSentence },
    { headline: "See the product mechanism", supportingText: "Connect the real feature to the outcome it creates." },
    { headline: "Move from friction to outcome", supportingText: "Make the customer's next step immediately understandable." },
    { headline: "Try the workflow", supportingText: cta },
  ];
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let reserved = false;
  const uploaded: MediaAsset[] = [];
  try {
    if (!hasDatabase()) return NextResponse.json({ error: "DATABASE_URL is required for image generation." }, { status: 503 });
    const { id } = ParamsSchema.parse(await context.params);
    const post = await getPostImageContext(id);
    if (!post) return NextResponse.json({ error: "This post was not found or can no longer be changed." }, { status: 404 });
    const rawBody = await request.text();
    const override = rawBody ? BodySchema.parse(JSON.parse(rawBody)) : {};
    const mediaType = override.mediaType ?? post.mediaType;

    let logo: Buffer | undefined;
    let warning: string | undefined;
    if (post.logoKey) {
      try { logo = await downloadStoredImage(post.logoKey); }
      catch (error) {
        console.warn("Project logo could not be loaded", error instanceof Error ? error.message : "Unknown error");
        warning = "The project logo could not be loaded, so the product name was used instead.";
      }
    }

    const recentStyles = [...(post.visualStyle ? [post.visualStyle] : []), ...await getRecentVisualStyles(post.projectId, post.postId)];
    const direction = await createCreativeDirection(post, recentStyles);
    let provider = "buildtoreach-renderer";
    let visual: { styleId: string; direction: Record<string, unknown> } = { styleId: direction.styleId, direction };

    if (mediaType === "carousel") {
      const frames = post.mediaPlan.frames.length >= 4
        ? post.mediaPlan.frames.slice(0, 5)
        : defaultFrames(mediaType, post.pillar, post.hook, post.body, post.cta);
      const slides = await renderCarouselSlides({ productName: post.projectName, pillar: post.pillar, frames, styleId: direction.styleId }, logo);
      const assets = await Promise.all(slides.map(async (bytes, index) => {
        const stored = await uploadGeneratedAsset({ bytes, projectId: post.projectId, postId: post.postId, extension: "jpg", contentType: "image/jpeg", suffix: `slide-${index + 1}` });
        return { ...stored, contentType: "image/jpeg" as const };
      }));
      uploaded.push(...assets);
      provider = "buildtoreach-carousel-renderer";
      visual = { styleId: direction.styleId, direction: { ...direction, frames, slideCount: frames.length } };
    } else if (mediaType === "motion") {
      const frames = post.mediaPlan.frames.length >= 3
        ? post.mediaPlan.frames.slice(0, 3)
        : defaultFrames(mediaType, post.pillar, post.hook, post.body, post.cta);
      const bytes = await renderMotionClip({ productName: post.projectName, pillar: post.pillar, frames, durationSeconds: post.mediaPlan.durationSeconds, styleId: direction.styleId }, logo);
      const stored = await uploadGeneratedAsset({ bytes, projectId: post.projectId, postId: post.postId, extension: "gif", contentType: "image/gif", suffix: "motion" });
      uploaded.push({ ...stored, contentType: "image/gif" });
      provider = "buildtoreach-motion-renderer";
      visual = { styleId: direction.styleId, direction: { ...direction, frames, durationSeconds: post.mediaPlan.durationSeconds } };
    } else {

      reserved = await reserveAIUsage("image", dailyAILimit("image"));
      if (!reserved) return NextResponse.json({ error: "The daily free image limit has been reached. Try again after 05:30 AM IST." }, { status: 429 });

      let background: Buffer | undefined;
      try {
        background = await generatePremiumBackground(premiumVisualPrompt(post, direction));
        provider = process.env.CLOUDFLARE_IMAGE_MODEL ?? "@cf/black-forest-labs/flux-2-klein-4b";
      } catch (error) {
        warning = error instanceof CloudflareAIError && error.quotaExceeded
          ? "The Cloudflare free allowance was reached, so ProReach used its accurate branded fallback."
          : "The premium background model was unavailable, so ProReach used its accurate branded fallback.";
        console.warn("Premium background generation unavailable", error instanceof Error ? error.message : "Unknown error");
      }

      const bytes = await renderSocialCard({
        productName: post.projectName,
        hook: post.hook,
        cta: post.cta,
        pillar: post.pillar,
        styleId: direction.styleId,
        textPlacement: direction.textPlacement,
        backgroundTone: direction.backgroundTone,
        overlayMotif: direction.overlayMotif,
      }, background, logo);
      const stored = await uploadGeneratedAsset({ bytes, projectId: post.projectId, postId: post.postId, extension: "jpg", contentType: "image/jpeg" });
      uploaded.push({ ...stored, contentType: "image/jpeg" });
      visual = { styleId: direction.styleId, direction };
    }

    const primary = uploaded[0];
    if (!primary) throw new Error("No media asset was rendered.");
    const updated = await setPostMedia(post.postId, {
      mediaUrl: primary.url, mediaKey: primary.key, mediaType, mediaItems: uploaded,
    }, visual);
    if (!updated) throw new Error("The post changed while its media was being generated.");

    const oldKeys = new Set([post.mediaKey, ...post.mediaItems.map((item) => item.key)].filter(Boolean));
    for (const key of oldKeys) {
      if (!uploaded.some((item) => item.key === key)) deleteGeneratedImage(key).catch((error) => console.warn("Old R2 media cleanup failed", error));
    }
    return NextResponse.json({ postId: post.postId, mediaType, mediaUrl: primary.url, mediaItems: uploaded, provider, creativeDirection: visual?.direction, warning });
  } catch (error) {
    await Promise.all(uploaded.map((asset) => deleteGeneratedImage(asset.key).catch(() => undefined)));
    if (reserved) await releaseAIUsage("image").catch(() => undefined);
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid post identifier." }, { status: 400 });
    console.error("Post image generation failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Media rendering failed. Check the R2 configuration and try again." }, { status: 500 });
  }
}
