import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { CloudflareAIError } from "@/lib/ai/cloudflare";
import { dailyAILimit } from "@/lib/ai/limits";
import { collectWebsiteContext, generateWebsiteProfile, WebsiteAnalysisError } from "@/lib/ai/project-profile";
import { releaseAIUsage, reserveAIUsage } from "@/lib/db";
import { requireAuthenticatedUser } from "@/lib/auth/user";

export const runtime = "nodejs";

const RequestSchema = z.object({ websiteUrl: z.string().trim().min(1).max(500) });

export async function POST(request: Request) {
  let userId: string | undefined;
  let reserved = false;
  try {
    const user = await requireAuthenticatedUser();
    userId = user.id;
    const { websiteUrl } = RequestSchema.parse(await request.json());
    reserved = await reserveAIUsage(user.id, "profile", dailyAILimit("profile"));
    if (!reserved) {
      return NextResponse.json({ error: "The daily website-autofill limit has been reached. Try again tomorrow." }, { status: 429 });
    }
    const source = await collectWebsiteContext(websiteUrl);
    const profile = await generateWebsiteProfile(source.context);
    return NextResponse.json({ profile, websiteUrl: source.websiteUrl, pagesAnalyzed: source.pages.length });
  } catch (error) {
    if (reserved && userId) {
      try { await releaseAIUsage(userId, "profile"); } catch (releaseError) {
        console.error("Website autofill quota reservation could not be released", releaseError);
      }
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Enter a valid website URL to autofill the project." }, { status: 400 });
    }
    if (error instanceof WebsiteAnalysisError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof CloudflareAIError) {
      const status = error.quotaExceeded ? 429 : error.status >= 400 && error.status < 600 ? error.status : 502;
      return NextResponse.json({ error: error.quotaExceeded ? "The AI service's daily allowance has been reached. Try again tomorrow." : error.message }, { status });
    }
    console.error("Website autofill failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "The website could not be analyzed right now. Try again in a moment." }, { status: 500 });
  }
}

