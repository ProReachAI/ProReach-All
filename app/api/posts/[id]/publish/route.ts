import { NextResponse } from "next/server";
import { z } from "zod";
import { claimPostNow, hasDatabase } from "@/lib/db";
import { dispatchPost } from "@/lib/platforms/dispatch";

export const runtime = "nodejs";
const ParamsSchema = z.object({ id: z.string().uuid() });
const BodySchema = z.object({ socialAccountId: z.string().uuid() });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!hasDatabase()) return NextResponse.json({ error: "DATABASE_URL is required to publish posts." }, { status: 503 });
    const { id } = ParamsSchema.parse(await context.params);
    const body = BodySchema.parse(await request.json());
    const post = await claimPostNow(id, body.socialAccountId);
    if (!post) return NextResponse.json({ error: "Approve this post and connect its destination account before publishing." }, { status: 409 });
    // A synchronous failure remains approved so the user can correct the
    // destination/content and retry without losing the approval decision.
    const result = await dispatchPost(post, { restoreApprovalOnFailure: true });
    if (!result.ok) return NextResponse.json({ error: result.error, status: "approved" }, { status: 502 });
    return NextResponse.json({
      id,
      status: "published",
      remotePostId: result.remotePostId,
      remotePostUrl: result.remotePostUrl ?? null,
      destination: {
        id: post.socialAccountId,
        displayName: post.accountDisplayName,
        type: post.accountMetadata.destinationType === "organization" ? "organization" : "person",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Choose a valid publishing destination." }, { status: 400 });
    console.error("Immediate publishing failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "The post could not be published." }, { status: 500 });
  }
}
