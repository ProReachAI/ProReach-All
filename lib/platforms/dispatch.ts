import type { DuePost } from "@/lib/db";
import { failPublishing, finishPublishing } from "@/lib/db";
import { getVerifiedIntegrationToken } from "@/lib/integrations/service";
import { publishPost } from "@/lib/platforms/publish";

export async function dispatchPost(post: DuePost, options?: { restoreApprovalOnFailure?: boolean }) {
  try {
    let publishable = post;
    if (post.integrationId && post.tokenExpiresAt && post.tokenExpiresAt.getTime() <= Date.now() + 5 * 60 * 1000) {
      const refreshed = await getVerifiedIntegrationToken(post.integrationId);
      publishable = { ...post, accessToken: refreshed.accessToken, tokenExpiresAt: null };
    }
    const result = await publishPost(publishable);
    await finishPublishing(post.id, result);
    return { ok: true as const, ...result };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown publishing failure";
    await failPublishing(post.id, reason, options?.restoreApprovalOnFailure ? "approved" : "failed");
    return { ok: false as const, error: reason };
  }
}
