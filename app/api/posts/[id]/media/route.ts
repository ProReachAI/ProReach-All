import { POST as generateMedia } from "../image/route";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return generateMedia(request, context);
}
