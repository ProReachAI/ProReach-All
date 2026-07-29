import type { NextConfig } from "next";

const appHost = (() => {
  try {
    return process.env.APP_URL ? new URL(process.env.APP_URL).hostname : undefined;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: appHost ? [appHost] : [],
};

export default nextConfig;
