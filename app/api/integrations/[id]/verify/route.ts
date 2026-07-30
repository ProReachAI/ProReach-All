import { NextResponse } from "next/server";
import { markIntegrationError, markIntegrationVerified } from "@/lib/integrations/repository";
import { getVerifiedIntegrationToken } from "@/lib/integrations/service";
import { getIntegrationSecret } from "@/lib/integrations/repository";
import { requireAuthenticatedUser } from "@/lib/auth/user";

export const runtime = "nodejs";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await requireAuthenticatedUser();
  try {
    if (!await getIntegrationSecret(id, user.id)) return NextResponse.json({ valid: false }, { status: 404 });
    await getVerifiedIntegrationToken(id);
    await markIntegrationVerified(id, user.id);
    return NextResponse.json({ valid: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Token verification failed.";
    await markIntegrationError(id, message, user.id);
    return NextResponse.json({ valid: false, reconnectRequired: true }, { status: 401 });
  }
}
