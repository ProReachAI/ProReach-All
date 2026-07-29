export const platforms = ["facebook", "instagram", "threads", "x", "linkedin"] as const;
export type Platform = (typeof platforms)[number];

export const integrationProviders = ["meta", "instagram", "threads", "x", "linkedin"] as const;
export type IntegrationProvider = (typeof integrationProviders)[number];
export type IntegrationStatus = "active" | "expired" | "revoked" | "error";

export type PostStatus =
  | "draft"
  | "review"
  | "approved"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed";

export type ContentPillar = "makeover" | "insight" | "building" | "proof";

export const mediaTypes = ["image", "carousel", "motion"] as const;
export type MediaType = (typeof mediaTypes)[number];

export type MediaFrame = {
  headline: string;
  supportingText: string;
};

export type MediaPlan = {
  frames: MediaFrame[];
  durationSeconds: 3 | 4 | 5;
};

export type MediaAsset = {
  url: string;
  key: string;
  contentType: "image/jpeg" | "image/png" | "image/gif";
};

export interface SocialPost {
  id: string;
  platform: Platform;
  pillar: ContentPillar;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  status: PostStatus;
  scheduledFor: string | null;
  mediaBrief?: string | null;
  mediaType: MediaType;
  mediaPlan: MediaPlan;
  mediaItems: MediaAsset[];
  mediaUrl?: string | null;
  mediaKey?: string | null;
  remotePostId?: string | null;
  remotePostUrl?: string | null;
  socialAccountId?: string | null;
  destinationName?: string | null;
  destinationType?: "person" | "organization" | null;
}

export interface Campaign {
  id: string;
  projectId: string;
  name: string;
  thesis: string;
  audience: string;
  posts: SocialPost[];
}

export interface ProductProject {
  id: string;
  name: string;
  slug: string;
  websiteUrl: string | null;
  logoUrl: string | null;
  logoKey: string | null;
  oneLiner: string;
  description: string;
  problemStatement: string;
  solution: string;
  targetAudience: string;
  audiencePainPoints: string;
  useCases: string;
  keyFeatures: string[];
  differentiators: string;
  proofPoints: string;
  competitors: string;
  brandVoice: string;
  toneGuidelines: string;
  wordsToUse: string[];
  wordsToAvoid: string[];
  primaryGoal: string;
  primaryCta: string;
  additionalContext: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionSummary {
  id?: string;
  provider: IntegrationProvider;
  label: string;
  connected: boolean;
  configured: boolean;
  status?: IntegrationStatus;
  accountName?: string;
  expiresAt?: string | null;
  accounts: Array<{
    id: string;
    platform: Platform;
    displayName: string;
    username?: string;
    destinationType?: "person" | "organization";
    enabled?: boolean;
  }>;
  note: string;
}

export const platformLabel: Record<Platform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  threads: "Threads",
  x: "X",
  linkedin: "LinkedIn",
};

export const providerLabel: Record<IntegrationProvider, string> = {
  meta: "Facebook",
  instagram: "Instagram",
  threads: "Threads",
  x: "X",
  linkedin: "LinkedIn",
};
