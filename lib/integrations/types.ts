import type { IntegrationProvider, Platform } from "@/lib/types";

export type OAuthToken = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  refreshExpiresAt?: Date;
  scopes: string[];
};

export type DiscoveredAccount = {
  platform: Platform;
  providerAccountId: string;
  displayName: string;
  accessToken: string;
  tokenExpiresAt?: Date;
  metadata?: Record<string, unknown>;
};

export type AuthorizationResult = {
  provider: IntegrationProvider;
  providerUserId: string;
  displayName: string;
  token: OAuthToken;
  metadata?: Record<string, unknown>;
  accounts: DiscoveredAccount[];
};
