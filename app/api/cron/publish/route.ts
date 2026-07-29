import { NextResponse } from "next/server";
import { claimDuePosts } from "@/lib/db";
import { dispatchPost } from "@/lib/platforms/dispatch";

export const runtime = "nodejs";

async function runPublisher(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const posts = await claimDuePosts(10);
    const results = await Promise.all(posts.map(async (post) => {
      const result = await dispatchPost(post);
      return { id: post.id, ...result };
    }));
    return NextResponse.json({ claimed: posts.length, results });
  } catch (error) {
    console.error("Publishing scheduler failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Scheduler failed" }, { status: 500 });
  }
}

// Vercel Cron invokes routes with GET. POST remains available for local testing
// and for schedulers that support an explicit HTTP method.
export const GET = runPublisher;
export const POST = runPublisher;
