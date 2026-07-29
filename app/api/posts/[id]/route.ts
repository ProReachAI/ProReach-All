import { NextResponse } from "next/server";
import { z } from "zod";
import { approvePost, createPostVariant, hasDatabase, scheduleApprovedPost, updatePostContent } from "@/lib/db";
import { platforms } from "@/lib/types";

export const runtime = "nodejs";
const ParamsSchema = z.object({ id: z.string().uuid() });
const BodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("create_variant"), platform: z.enum(platforms) }),
  z.object({ action: z.literal("schedule"), scheduledFor: z.string().datetime({ offset: true }), socialAccountId: z.string().uuid() }),
  z.object({
    action: z.literal("update"),
    hook: z.string().trim().min(3).max(300),
    body: z.string().trim().min(10).max(5000),
    cta: z.string().trim().max(500),
    hashtags: z.array(z.string().trim().min(2).max(50)).max(8),
  }),
]);

function normalizeHashtags(values: string[]) {
  return [...new Set(values.map((value) => `#${value.replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "")}`)
    .filter((value) => value.length > 1))].slice(0, 8);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!hasDatabase()) return NextResponse.json({ error: "DATABASE_URL is required to manage posts." }, { status: 503 });
    const body = BodySchema.parse(await request.json());
    const { id } = ParamsSchema.parse(await context.params);
    if (body.action === "approve") {
      const status = await approvePost(id);
      if (!status) return NextResponse.json({ error: "Post was not found or cannot be approved." }, { status: 404 });
      return NextResponse.json({ id, status });
    }
    if (body.action === "create_variant") {
      const post = await createPostVariant(id, body.platform);
      if (!post) return NextResponse.json({ error: "The source post was not found or cannot be copied." }, { status: 404 });
      return NextResponse.json({ post });
    }
    if (body.action === "update") {
      const updated = await updatePostContent(id, { ...body, hashtags: normalizeHashtags(body.hashtags) });
      if (!updated) return NextResponse.json({ error: "This post cannot be edited after publishing has started." }, { status: 409 });
      return NextResponse.json({ id, ...updated });
    }
    const scheduledFor = new Date(body.scheduledFor);
    if (scheduledFor.getTime() <= Date.now()) return NextResponse.json({ error: "Choose a future publishing time." }, { status: 400 });
    const result = await scheduleApprovedPost(id, scheduledFor, body.socialAccountId);
    if (!result) return NextResponse.json({ error: "Approve this post and connect its destination account before scheduling." }, { status: 409 });
    return NextResponse.json({ id, status: result.status, scheduledFor: result.scheduledFor.toISOString() });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "The publishing action or schedule time is invalid." }, { status: 400 });
    console.error("Post action failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "The post action failed." }, { status: 500 });
  }
}
