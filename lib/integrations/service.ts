import { getIntegrationSecret, markIntegrationError, updateIntegrationTokens } from "@/lib/integrations/repository";
import { refreshProviderToken, verifyProviderIdentity } from "@/lib/integrations/providers";

const REFRESH_WINDOW_MS = 5 * 60 * 1000;

export async function getVerifiedIntegrationToken(id: string) {
  const integration = await getIntegrationSecret(id);
  if (!integration) throw new Error("Integration not found.");
  const shouldRefresh = integration.provider === "threads"
    ? Boolean(integration.expiresAt && integration.expiresAt.getTime() <= Date.now() + REFRESH_WINDOW_MS)
    : Boolean(integration.expiresAt && integration.expiresAt.getTime() <= Date.now() + REFRESH_WINDOW_MS);

  let accessToken = integration.accessToken;
  if (shouldRefresh) {
    try {
      const refreshed = await refreshProviderToken(integration);
      await updateIntegrationTokens(id, refreshed);
      accessToken = refreshed.accessToken;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Token refresh failed.";
      await markIntegrationError(id, message);
      throw error;
    }
  }
  await verifyProviderIdentity(integration.provider, accessToken);
  return { provider: integration.provider, accessToken };
}
