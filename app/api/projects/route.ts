import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createProject, listProjects } from "@/lib/projects";
import { requireAuthenticatedUser } from "@/lib/auth/user";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    return NextResponse.json({ projects: await listProjects(user.id, user.name) });
  } catch (error) {
    console.error("Project listing failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Projects could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const project = await createProject(user.id, user.name, await request.json());
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Complete the required product context before continuing.", issues: error.issues }, { status: 400 });
    }
    console.error("Project creation failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Project creation failed." }, { status: 500 });
  }
}
