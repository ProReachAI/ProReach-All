export function canonicalOAuthStartUrl(requestUrl: string | URL, appUrl?: string, incomingHost?: string | null) {
  if (!appUrl) return undefined;

  const request = new URL(requestUrl);
  const configuredOrigin = new URL(appUrl);
  const browserFacingHost = incomingHost?.split(",")[0]?.trim() || request.host;
  if (browserFacingHost === configuredOrigin.host) return undefined;

  return new URL(`${request.pathname}${request.search}`, configuredOrigin);
}
