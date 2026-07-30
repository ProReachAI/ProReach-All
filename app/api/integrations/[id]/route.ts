import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteIntegration, getIntegrationSecret, setEnabledSocialAccounts } from "@/lib/integrations/repository";
import { revokeProviderToken } from "@/lib/integrations/providers";
import { requireAuthenticatedUser } from "@/lib/auth/user";

export const runtime = "nodejs";

const selectionSchema = z.object({
  accountIds: z.array(z.string().uuid()).min(1).max(100),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const payload = selectionSchema.parse(await request.json());
    const user = await requireAuthenticatedUser();
    const accountIds = await setEnabledSocialAccounts(user.id, id, [...new Set(payload.accountIds)]);
    return NextResponse.json({ accountIds });
  } catch (error) {
    const message = error instanceof z.ZodError
      ? "Choose at least one valid publishing destination."
      : error instanceof Error ? error.message : "Unable to update publishing destinations.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const user = await requireAuthenticatedUser();
    const integration = await getIntegrationSecret(id, user.id);
    if (!integration) return NextResponse.json({ error: "Integration not found." }, { status: 404 });
    let remoteRevocation = "not_supported";
    try {
      await revokeProviderToken(integration.provider, integration.accessToken);
      remoteRevocation = ["x", "meta", "instagram"].includes(integration.provider) ? "revoked" : "not_supported";
    } catch (error) {
      remoteRevocation = "failed";
      console.warn("Remote token revocation failed", integration.provider, error instanceof Error ? error.message : "Unknown error");
    }
    await deleteIntegration(id, user.id);
    return NextResponse.json({ disconnected: true, remoteRevocation });
  } catch (error) {
    console.error("Integration disconnect failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Unable to disconnect this integration." }, { status: 500 });
  }
}
