import { NextResponse } from "next/server";
import { deleteIntegration, getIntegrationSecret } from "@/lib/integrations/repository";
import { revokeProviderToken } from "@/lib/integrations/providers";

export const runtime = "nodejs";

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const integration = await getIntegrationSecret(id);
    if (!integration) return NextResponse.json({ error: "Integration not found." }, { status: 404 });
    let remoteRevocation = "not_supported";
    try {
      await revokeProviderToken(integration.provider, integration.accessToken);
      remoteRevocation = ["x", "meta", "instagram"].includes(integration.provider) ? "revoked" : "not_supported";
    } catch (error) {
      remoteRevocation = "failed";
      console.warn("Remote token revocation failed", integration.provider, error instanceof Error ? error.message : "Unknown error");
    }
    await deleteIntegration(id);
    return NextResponse.json({ disconnected: true, remoteRevocation });
  } catch (error) {
    console.error("Integration disconnect failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Unable to disconnect this integration." }, { status: 500 });
  }
}
