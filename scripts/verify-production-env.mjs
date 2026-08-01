const isVercelProduction = process.env.VERCEL_ENV === "production";
const productionOrigin = "https://www.proreach.in";

if (isVercelProduction) {
  const required = [
    "APP_URL",
    "NEXT_PUBLIC_SITE_URL",
    "TOKEN_ENCRYPTION_KEY",
    "DATABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "AI_PROVIDER",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_API_TOKEN",
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "R2_PUBLIC_BASE_URL",
    "META_APP_ID",
    "META_APP_SECRET",
    "INSTAGRAM_APP_ID",
    "INSTAGRAM_APP_SECRET",
  ];
  const failures = required.filter((key) => !process.env[key]?.trim()).map((key) => `${key} is missing`);

  function urlFor(key) {
    const value = process.env[key];
    if (!value) return undefined;
    try {
      return new URL(value);
    } catch {
      failures.push(`${key} is not a valid URL`);
      return undefined;
    }
  }

  const appUrl = urlFor("APP_URL");
  const siteUrl = urlFor("NEXT_PUBLIC_SITE_URL");
  const databaseUrl = urlFor("DATABASE_URL");
  const supabaseUrl = urlFor("NEXT_PUBLIC_SUPABASE_URL");
  const r2PublicUrl = urlFor("R2_PUBLIC_BASE_URL");

  for (const [key, value] of [["APP_URL", appUrl], ["NEXT_PUBLIC_SITE_URL", siteUrl]]) {
    if (value && value.protocol !== "https:") failures.push(`${key} must use HTTPS in production`);
    if (value && (value.hostname === "localhost" || value.hostname.endsWith(".ngrok-free.dev"))) {
      failures.push(`${key} cannot point to a local or temporary tunnel host in production`);
    }
  }
  if (appUrl && siteUrl && appUrl.origin !== siteUrl.origin) {
    failures.push("APP_URL and NEXT_PUBLIC_SITE_URL must use the same production origin");
  }
  if (appUrl && appUrl.origin !== productionOrigin) {
    failures.push(`APP_URL must be ${productionOrigin} because that is the canonical production host`);
  }
  if (siteUrl && siteUrl.origin !== productionOrigin) {
    failures.push(`NEXT_PUBLIC_SITE_URL must be ${productionOrigin} because that is the canonical production host`);
  }
  if (databaseUrl) {
    if (!databaseUrl.protocol.startsWith("postgres")) failures.push("DATABASE_URL must be a PostgreSQL URL");
    if (!databaseUrl.hostname || ["localhost", "127.0.0.1", "::1"].includes(databaseUrl.hostname)) {
      failures.push("DATABASE_URL must point to the production Supabase database");
    }
  }
  if (supabaseUrl && (supabaseUrl.protocol !== "https:" || !supabaseUrl.hostname.endsWith(".supabase.co"))) {
    failures.push("NEXT_PUBLIC_SUPABASE_URL must be the HTTPS Supabase project URL");
  }
  if (databaseUrl && supabaseUrl?.hostname.endsWith(".supabase.co")) {
    const projectRef = supabaseUrl.hostname.split(".")[0];
    const databaseUser = decodeURIComponent(databaseUrl.username);
    const matchesDirectHost = databaseUrl.hostname === `db.${projectRef}.supabase.co`;
    const matchesPoolerUser = databaseUser === `postgres.${projectRef}`;
    if (!matchesDirectHost && !matchesPoolerUser) {
      failures.push("DATABASE_URL and NEXT_PUBLIC_SUPABASE_URL must belong to the same Supabase project");
    }
  }
  if (r2PublicUrl && r2PublicUrl.protocol !== "https:") failures.push("R2_PUBLIC_BASE_URL must use HTTPS");

  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
  if (encryptionKey && Buffer.from(encryptionKey, "base64").byteLength !== 32) {
    failures.push("TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }
  if (process.env.AI_PROVIDER && process.env.AI_PROVIDER !== "cloudflare") {
    failures.push("AI_PROVIDER must be cloudflare");
  }

  if (failures.length) {
    console.error(`Production environment validation failed:\n- ${failures.join("\n- ")}`);
    process.exit(1);
  }

  console.log("Production environment validation passed.");
}
