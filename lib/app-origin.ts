export const LOCAL_APP_ORIGIN = "http://localhost:3000";
export const PRODUCTION_APP_ORIGIN = "https://www.proreach.in";

/**
 * Keep application routes on the environment that is actually running them.
 * Database selection is intentionally unrelated: localhost may use either a
 * local PostgreSQL database or Supabase without changing any browser URL.
 */
export function appOrigin() {
  if (process.env.VERCEL_ENV === "production") return PRODUCTION_APP_ORIGIN;
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    return new URL(`https://${process.env.VERCEL_URL}`).origin;
  }
  return LOCAL_APP_ORIGIN;
}

export function appUrl(path: string) {
  return new URL(path, appOrigin());
}
