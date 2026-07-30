# Architecture

## System boundary

The app owns campaign intent, drafts, approvals, schedules, encrypted provider credentials, and an audit log. Providers remain the source of truth for published content and engagement metrics.

```text
Product brief
    |
    v
Cloudflare campaign planner -> validated post variants -> approval calendar
                                      |                       |
                                      v                       v
                    FLUX.2 scene + brand renderer -> R2 due-post scheduler
                                                     |
                  +---------------+----------------+---------------+
                  v               v                v               v
         Meta grant          Threads              X          LinkedIn
        /          \
 Facebook Pages   Instagram professional accounts
```

## Main components

- `app/api/generate`: creates a structured campaign and stores it when PostgreSQL is configured.
- `app/api/posts/[id]/image`: generates a text-free premium FLUX.2 scene, composites exact typography and branding, uploads it to R2, and stores the public URL.
- `app/api/oauth/[platform]`: creates a one-time database OAuth session and builds the provider authorization URL.
- `app/api/oauth/[platform]/callback`: atomically consumes the session, exchanges the code, discovers publishing accounts, and persists encrypted grants/tokens.
- `app/api/integrations/[id]/verify`: refreshes expiring tokens where supported and performs a live identity call.
- `app/api/integrations/[id]`: revokes remotely where supported and always deletes local encrypted credentials.
- `app/api/posts/[id]`: handles approval and scheduling transitions.
- `app/api/cron/publish`: locks due work, calls the provider adapter, and records the result.
- `lib/integrations`: provider-specific OAuth, discovery, refresh, verification, and persistence.
- `lib/platforms`: destination-specific publishing behavior.
- `lib/ai`: Cloudflare Workers AI campaign-text and premium-background clients, visual art direction, and daily usage limits.
- `lib/media`: private R2 API access and public media URL construction.
- `lib/projects`: validated PostgreSQL repository for reusable product context and project selection.
- `lib/db`: PostgreSQL repository for project-scoped campaigns, posts, scheduling, and publishing events. There is no demo fallback.

## Security decisions

- Every Supabase user owns a private workspace, and all application queries derive workspace ownership from the verified Google/Supabase `sub` claim.
- Projects own integrations, OAuth sessions, discovered social accounts, campaigns, and publishing destinations; switching a project never changes ownership checks.
- Provider tokens are encrypted with AES-256-GCM using `TOKEN_ENCRYPTION_KEY`.
- OAuth state is hash-only and one-time in PostgreSQL; the browser holds a separate short-lived HTTP-only binding cookie.
- X PKCE verifiers are encrypted server-side and deleted from the usable flow when the session is consumed.
- The cron route requires a bearer secret and uses database row locking to avoid duplicate sends.
- Provider responses and failures are logged without plaintext access/refresh tokens.
- Public Supabase Data API roles have no table policies; RLS is enabled and application access stays behind the direct server connection.
- Automatic posting is a policy on a content category, not a global switch.

## Production checklist

1. Store encryption keys in a managed secret store and define key rotation.
2. Complete provider app review and publish privacy/data-deletion policies.
3. Configure a queue with retry/backoff and dead-letter handling.
4. Add idempotency keys and provider-specific rate-limit budgets.
5. Add webhook signature verification where provider webhooks are enabled.
6. Add content moderation, prohibited-claim checks, and brand facts as grounded inputs.
7. Add analytics ingestion only for approved scopes; minimize retained personal data.
