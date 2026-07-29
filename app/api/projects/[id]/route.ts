import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getProject, updateProject } from "@/lib/projects";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const project = await getProject(id);
  return project
    ? NextResponse.json({ project })
    : NextResponse.json({ error: "Project not found." }, { status: 404 });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const project = await updateProject(id, await request.json());
    return project
      ? NextResponse.json({ project })
      : NextResponse.json({ error: "Project not found." }, { status: 404 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Complete the required product context before continuing.", issues: error.issues }, { status: 400 });
    }
    console.error("Project update failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Project update failed." }, { status: 500 });
  }
}
