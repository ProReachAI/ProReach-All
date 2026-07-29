import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DuePost } from "@/lib/db";

const { finishPublishing, failPublishing, publishPost } = vi.hoisted(() => ({
  finishPublishing: vi.fn(),
  failPublishing: vi.fn(),
  publishPost: vi.fn(),
}));

vi.mock("@/lib/db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db")>("@/lib/db");
  return { ...actual, finishPublishing, failPublishing };
});
vi.mock("@/lib/platforms/publish", () => ({ publishPost }));
vi.mock("@/lib/integrations/service", () => ({ getVerifiedIntegrationToken: vi.fn() }));

import { dispatchPost } from "@/lib/platforms/dispatch";

const post: DuePost = {
  id: "72b70bed-70bb-4411-9ff4-8d11a79bc98c",
  integrationId: null,
  platform: "linkedin",
  hook: "A clear hook",
  body: "A useful body",
  cta: "Read more",
  hashtags: ["#ProductMarketing", "#BuildInPublic"],
  mediaType: "image",
  mediaItems: [],
  mediaUrl: null,
  accessToken: "encrypted-at-rest-token",
  tokenExpiresAt: null,
  providerAccountId: "member-1",
  accountMetadata: {},
  accountScopes: ["w_member_social"],
  accountDisplayName: "Test member",
  socialAccountId: "00000000-0000-4000-8000-000000000001",
};

describe("publishing dispatch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("records the provider result after a successful publish", async () => {
    publishPost.mockResolvedValue({ remotePostId: "urn:li:share:1", remotePostUrl: "https://linkedin.example/post/1" });

    await expect(dispatchPost(post)).resolves.toEqual({
      ok: true,
      remotePostId: "urn:li:share:1",
      remotePostUrl: "https://linkedin.example/post/1",
    });
    expect(finishPublishing).toHaveBeenCalledWith(post.id, expect.objectContaining({ remotePostId: "urn:li:share:1" }));
  });

  it("restores approval after an immediate provider failure so the user can retry", async () => {
    publishPost.mockRejectedValue(new Error("LinkedIn rejected the request"));

    await expect(dispatchPost(post, { restoreApprovalOnFailure: true })).resolves.toEqual({
      ok: false,
      error: "LinkedIn rejected the request",
    });
    expect(failPublishing).toHaveBeenCalledWith(post.id, "LinkedIn rejected the request", "approved");
  });
});
