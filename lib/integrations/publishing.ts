import type { ConnectionSummary, Platform, SocialPost } from "@/lib/types";

export type PublishingDestination = ConnectionSummary["accounts"][number] & {
  provider: ConnectionSummary["provider"];
};

export function activePublishingDestinations(connections: ConnectionSummary[]): PublishingDestination[] {
  return connections
    .filter((connection) => connection.connected && connection.status !== "error" && connection.status !== "revoked")
    .flatMap((connection) => connection.accounts.map((account) => ({ ...account, provider: connection.provider })));
}

export function destinationsForPlatform(connections: ConnectionSummary[], platform: Platform) {
  return activePublishingDestinations(connections).filter((account) => account.platform === platform);
}

export function publishingReadiness(post: SocialPost, connections: ConnectionSummary[]) {
  const destinations = destinationsForPlatform(connections, post.platform);
  const hasMedia = Boolean(post.mediaUrl || post.mediaItems.length);
  return {
    destinations,
    connected: destinations.length > 0,
    hasMedia,
    ready: destinations.length > 0 && hasMedia,
  };
}
