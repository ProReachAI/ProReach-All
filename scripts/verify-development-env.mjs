const localOrigin = "http://localhost:3000";
const failures = [];

function requiredUrl(key) {
  const value = process.env[key]?.trim();
  if (!value) {
    failures.push(`${key} is missing`);
    return undefined;
  }
  try {
    return new URL(value);
  } catch {
    failures.push(`${key} is not a valid URL`);
    return undefined;
  }
}

const appUrl = requiredUrl("APP_URL");
const siteUrl = requiredUrl("NEXT_PUBLIC_SITE_URL");
const databaseUrl = requiredUrl("DATABASE_URL");
const supabaseUrl = requiredUrl("NEXT_PUBLIC_SUPABASE_URL");

if (appUrl && appUrl.origin !== localOrigin) {
  failures.push(`APP_URL must be ${localOrigin} for local development`);
}
if (siteUrl && siteUrl.origin !== localOrigin) {
  failures.push(`NEXT_PUBLIC_SITE_URL must be ${localOrigin} for local development`);
}
if (databaseUrl && !databaseUrl.protocol.startsWith("postgres")) {
  failures.push("DATABASE_URL must be a PostgreSQL URL");
}
if (databaseUrl && supabaseUrl?.hostname.endsWith(".supabase.co")) {
  const databaseIsLocal = ["localhost", "127.0.0.1", "::1"].includes(databaseUrl.hostname);
  if (!databaseIsLocal) {
    const projectRef = supabaseUrl.hostname.split(".")[0];
    const databaseUser = decodeURIComponent(databaseUrl.username);
    const matchesDirectHost = databaseUrl.hostname === `db.${projectRef}.supabase.co`;
    const matchesPoolerUser = databaseUser === `postgres.${projectRef}`;
    if (!matchesDirectHost && !matchesPoolerUser) {
      failures.push("Remote DATABASE_URL must match NEXT_PUBLIC_SUPABASE_URL");
    }
  }
}

if (failures.length) {
  console.error(`Local environment validation failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

const databaseMode = databaseUrl && ["localhost", "127.0.0.1", "::1"].includes(databaseUrl.hostname)
  ? "local PostgreSQL"
  : "Supabase PostgreSQL";
console.log(`Local environment validation passed (${localOrigin}, ${databaseMode}).`);
