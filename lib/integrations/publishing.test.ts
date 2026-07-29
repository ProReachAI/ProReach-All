import { describe, expect, it } from "vitest";
import { activePublishingDestinations, destinationsForPlatform, publishingReadiness } from "@/lib/integrations/publishing";
import type { ConnectionSummary, SocialPost } from "@/lib/types";

const connections: ConnectionSummary[] = [
  {
    provider: "instagram",
    label: "Instagram",
    connected: true,
    configured: true,
    status: "active",
    accounts: [{ id: "ig-1", platform: "instagram", displayName: "ProPhrase", username: "prophraseai" }],
    note: "Connected",
  },
  {
    provider: "linkedin",
    label: "LinkedIn",
    connected: false,
    configured: true,
    status: "error",
    accounts: [{ id: "li-1", platform: "linkedin", displayName: "Naga" }],
    note: "Expired",
  },
];

const post: SocialPost = {
  id: "post-1",
  platform: "instagram",
  pillar: "insight",
  hook: "A useful hook",
  body: "A useful body for this post.",
  cta: "Learn more",
  hashtags: ["#ProPhrase"],
  status: "approved",
  scheduledFor: null,
  mediaType: "image",
  mediaPlan: { frames: [], durationSeconds: 4 },
  mediaItems: [],
  mediaUrl: "https://cdn.example.com/post.jpg",
};

describe("publishing connection readiness", () => {
  it("returns only destinations from active connections", () => {
    expect(activePublishingDestinations(connections).map((account) => account.id)).toEqual(["ig-1"]);
  });

  it("does not treat Instagram as a destination for a LinkedIn draft", () => {
    expect(destinationsForPlatform(connections, "linkedin")).toEqual([]);
  });

  it("marks an Instagram draft with media ready to publish", () => {
    expect(publishingReadiness(post, connections)).toMatchObject({ connected: true, hasMedia: true, ready: true });
  });
});
