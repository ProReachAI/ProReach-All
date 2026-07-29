import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { CloudflareAIError } from "@/lib/ai/cloudflare";
import { CampaignRequestSchema, generateCampaign } from "@/lib/ai/campaign";
import { dailyAILimit } from "@/lib/ai/limits";
import { hasDatabase, releaseAIUsage, reserveAIUsage, saveCampaign } from "@/lib/db";
import { getProject } from "@/lib/projects";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!hasDatabase()) return NextResponse.json({ error: "DATABASE_URL is required for project-based generation." }, { status: 503 });
    const brief = CampaignRequestSchema.parse(await request.json());
    const project = await getProject(brief.projectId);
    if (!project) return NextResponse.json({ error: "Select a valid project before generating." }, { status: 404 });
    const reserved = await reserveAIUsage("campaign", dailyAILimit("campaign"));
    if (!reserved) {
      return NextResponse.json({ error: "The daily free campaign limit has been reached. Try again after 05:30 AM IST." }, { status: 429 });
    }
    try {
      const campaign = await generateCampaign(project, brief);
      try {
        await saveCampaign(campaign, brief);
      } catch (error) {
        console.error("Generated campaign could not be saved", error instanceof Error ? error.message : "Unknown error");
        return NextResponse.json({ error: "Drafts were generated but could not be saved. Check that all database migrations have been applied, then try again." }, { status: 500 });
      }
      return NextResponse.json({ campaign, mode: "cloudflare" });
    } catch (error) {
      try {
        await releaseAIUsage("campaign");
      } catch (releaseError) {
        // Quota cleanup must never hide the actual provider or validation error.
        console.error("Campaign quota reservation could not be released", releaseError);
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Please complete every brief field with specific information." }, { status: 400 });
    }
    if (error instanceof CloudflareAIError) {
      const status = error.quotaExceeded ? 429 : error.status >= 400 && error.status < 600 ? error.status : 502;
      const message = error.quotaExceeded
        ? "Cloudflare's daily free AI allowance has been reached. Try again after 05:30 AM IST. No paid fallback was used."
        : error.message;
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Campaign generation failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Campaign generation failed. Try again in a moment." }, { status: 500 });
  }
}
