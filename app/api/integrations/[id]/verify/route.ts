import { NextResponse } from "next/server";
import { markIntegrationError, markIntegrationVerified } from "@/lib/integrations/repository";
import { getVerifiedIntegrationToken } from "@/lib/integrations/service";

export const runtime = "nodejs";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    await getVerifiedIntegrationToken(id);
    await markIntegrationVerified(id);
    return NextResponse.json({ valid: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Token verification failed.";
    await markIntegrationError(id, message);
    return NextResponse.json({ valid: false, reconnectRequired: true }, { status: 401 });
  }
}
