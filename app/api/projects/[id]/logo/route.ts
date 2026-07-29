import { NextResponse } from "next/server";
import sharp from "sharp";
import { z } from "zod";
import { getProject, setProjectLogo } from "@/lib/projects";
import { deleteGeneratedImage, uploadProjectLogo } from "@/lib/media/r2";

export const runtime = "nodejs";

const ParamsSchema = z.object({ id: z.string().uuid() });
const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const maximumBytes = 5 * 1024 * 1024;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let uploaded: { key: string; url: string } | undefined;
  try {
    const { id } = ParamsSchema.parse(await context.params);
    const project = await getProject(id);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

    const form = await request.formData();
    const file = form.get("logo");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a logo file." }, { status: 400 });
    if (!allowedTypes.has(file.type)) {
      return NextResponse.json({ error: "Use a PNG, JPEG, or WebP logo." }, { status: 415 });
    }
    if (file.size < 1 || file.size > maximumBytes) {
      return NextResponse.json({ error: "The logo must be smaller than 5 MB." }, { status: 413 });
    }

    const source = Buffer.from(await file.arrayBuffer());
    const logo = await sharp(source, { limitInputPixels: 24_000_000 })
      .rotate()
      .trim({ background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .resize({ width: 1200, height: 500, fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9, palette: false })
      .toBuffer();

    uploaded = await uploadProjectLogo({ bytes: logo, projectId: id });
    const updated = await setProjectLogo(id, uploaded.url, uploaded.key);
    if (!updated) throw new Error("The project changed while its logo was being uploaded.");

    if (project.logoKey && project.logoKey !== uploaded.key) {
      deleteGeneratedImage(project.logoKey).catch((error) => console.warn("Old logo cleanup failed", error));
    }
    return NextResponse.json({ project: updated });
  } catch (error) {
    if (uploaded) await deleteGeneratedImage(uploaded.key).catch(() => undefined);
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid project identifier." }, { status: 400 });
    console.error("Project logo upload failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Logo upload failed. Check the file and R2 configuration." }, { status: 500 });
  }
}
