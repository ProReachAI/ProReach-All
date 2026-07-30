import { NextResponse } from "next/server";
import { listConnections } from "@/lib/integrations/repository";
import { requireAuthenticatedUser } from "@/lib/auth/user";
import { z } from "zod";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const projectId = z.string().uuid().parse(new URL(request.url).searchParams.get("project"));
    return NextResponse.json({ connections: await listConnections(user.id, projectId) });
  } catch (error) {
    console.error("Integration list failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Unable to load integrations." }, { status: 500 });
  }
}
