# BuildToReach

An approval-first marketing agent for indie builders. Connect Facebook Pages, Instagram professional accounts, Threads, X, and LinkedIn; then plan, approve, and publish from one place.

## What the MVP does

- Creates a seven-day campaign from a product brief using Cloudflare Workers AI.
- Uses a creative-director pass to rotate among distinct visual concepts, generates the background with FLUX.2, then overlays exact brand-controlled English text and the uploaded company logo before storing the finished card in R2.
- Adapts the hook, length, CTA, and format for each social platform.
- Keeps generated posts in draft or review until you approve them.
- Connects providers with replay-safe OAuth sessions and encrypts every grant/token at rest.
- Connects Facebook Pages and Instagram professional accounts independently, so Instagram publishing does not require a Facebook Page link.
- Verifies connections, refreshes X/Threads/eligible LinkedIn tokens, and supports disconnect/revocation.
- Publishes due posts through a protected scheduler endpoint.
- Records publishing success/failure and remote post IDs.
- Starts with a real project onboarding flow and never seeds example campaigns, posts, metrics, or product claims.
- Stores reusable product context: product truth, audience, pain points, positioning, proof, voice, goals, and claim guardrails.
- Lets you switch projects from the dashboard and keeps every campaign scoped to the selected project.

## Local setup

```bash
cp .env.example .env.local
npm install
docker compose up -d
psql "postgresql://postgres:postgres@localhost:5432/marketing_agent" -f db/schema.sql
npm run dev
```

Generate secrets before starting:

```bash
openssl rand -base64 32  # TOKEN_ENCRYPTION_KEY
openssl rand -hex 32     # CRON_SECRET
```

Open [http://localhost:3000](http://localhost:3000).

For a production deployment, create the PostgreSQL schema in `db/schema.sql`, set all environment variables, and register these exact OAuth callbacks with each provider. Existing installations should run every migration through `db/migrations/0009_direct_instagram.sql`:

```text
http://localhost:3000/api/oauth/meta/callback
http://localhost:3000/api/oauth/instagram/callback
http://localhost:3000/api/oauth/x/callback
http://localhost:3000/api/oauth/threads/callback
http://localhost:3000/api/oauth/linkedin/callback
```

Replace `http://localhost:3000` with the deployed `APP_URL` in production.

Business Login for Instagram requires a publicly reachable HTTPS redirect URL. For local testing, expose port 3000 through an HTTPS tunnel, set `APP_URL` to that tunnel origin, register `${APP_URL}/api/oauth/instagram/callback` in Meta, restart Next.js, and open the application through the same HTTPS origin so the OAuth binding cookie returns to the correct host.

Open `/setup/integrations` for provider-by-provider environment variables, scopes, portals, and exact callback URLs. If the database already uses the original MVP schema, run the SQL files in `db/migrations` in numeric order instead of recreating it.

## Product workflow

1. Create a project from the empty dashboard.
2. Upload the real company logo and complete the product, customer, positioning/proof, and voice context.
3. Select the project from the top-bar dropdown.
4. Generate a campaign by supplying only the current goal, timely focus, instructions, and platforms.
5. Generate or replace a visual for posts that need one.
6. Review a draft and approve it. Approval alone never sends the post.
7. Choose **Post now** to publish immediately, **Schedule** to add it to the protected publishing queue, or keep it approved for later.

There is intentionally no demo-data fallback. PostgreSQL and Cloudflare Workers AI are required for campaign writing and premium background generation; R2 stores the finished branded social cards. Exact text and brand elements are rendered by the application rather than entrusted to the image model. If the image model is unavailable, BuildToReach falls back to its deterministic renderer. Provider connections remain workspace-wide, while campaigns and posts are scoped to a project. Application-level daily limits provide a second guardrail in addition to Cloudflare's free-plan limit.

## Scheduling

Call the protected endpoint every minute (or every five minutes if a small delay is acceptable). Both `GET` and `POST` are supported:

```bash
curl https://your-domain.com/api/cron/publish \
  -H "Authorization: Bearer $CRON_SECRET"
```

Vercel Cron, Cloudflare Cron Triggers, GitHub Actions, Trigger.dev, or any standard scheduler can make this request. The endpoint atomically claims due posts, so overlapping scheduler calls cannot publish the same queued row twice. `Post now` does not depend on the scheduler; it dispatches directly after the user confirms the action.

## Safety model

The default mode is human approval. A post moves through:

```text
draft -> review -> approved -> scheduled -> publishing -> published
                                            \-> failed
```

Auto-publish should only be enabled per content category after reviewing at least two weeks of successful output. Tokens and PKCE verifiers are encrypted with AES-256-GCM. OAuth state is stored as a one-way hash in a one-time database session and bound to a short-lived HTTP-only SameSite cookie, so callbacks expire and cannot be replayed.

## Platform setup notes

- **Facebook:** uses Facebook Login for Business to discover manageable Facebook Pages. Public Page publishing requires Meta review/Advanced Access; development-mode access is restricted to app roles/testers.
- **Instagram:** uses Business Login for Instagram with `instagram_business_basic` and `instagram_business_content_publish`. It connects a professional account directly and does not require a linked Facebook Page. Public access still requires the appropriate Meta review/Advanced Access; development-mode access is restricted to app roles/testers.
- **Threads:** create a Meta Threads app and request `threads_basic` and `threads_content_publish`.
- **X:** enable OAuth 2.0 Authorization Code with PKCE and request `tweet.read`, `tweet.write`, `users.read`, and `offline.access`. API requests are usage-billed.
- **LinkedIn:** company Page publishing requires Community Management API access for a registered legal organization. BuildToReach's LinkedIn Connect action requests `openid`, `profile`, `w_member_social`, `rw_organization_admin`, and `w_organization_social`, discovers administered Pages, and requires an explicit destination choice when both a Page and personal profile are available.

Run the provider contract tests with `npm test`. They mock the external exchanges and assert X PKCE, Threads long-lived exchange, Meta Page/Instagram discovery, and LinkedIn OIDC identity handling. A real end-to-end OAuth test still requires your own developer-app credentials because callback URLs and app roles are provider-owned configuration.

## Deliberate MVP limits

- Instagram posts require a generated, publicly accessible image before publishing. Direct Instagram Login uses `graph.instagram.com`; legacy Page-linked grants continue to use `graph.facebook.com`.
- LinkedIn and Meta posts support generated images; X and Threads remain text-only in this first release.
- Native video upload remains a follow-up milestone.
- Analytics collection is schema-ready but not enabled until provider read permissions and cost limits are configured.
- This is a single-workspace foundation. Add an identity provider and workspace membership before offering it as a multi-tenant SaaS.
- Until application login is added, deploy behind private access; OAuth grants currently bind to the single `default` workspace.

See [docs/30-day-growth-plan.md](docs/30-day-growth-plan.md) for the operating strategy and [docs/architecture.md](docs/architecture.md) for the implementation map.
See [docs/creative-system.md](docs/creative-system.md) for the product-ad archetypes, no-real-human policy, and media rendering pipeline.
