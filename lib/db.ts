import { userInfo } from "node:os";
import { Pool, type PoolClient, type PoolConfig } from "pg";
import { decryptSecret, encryptSecret } from "@/lib/security/crypto";
import type { Campaign, MediaAsset, MediaPlan, MediaType, Platform } from "@/lib/types";

let pool: Pool | undefined;

export function databasePoolConfig(connectionString = process.env.DATABASE_URL): PoolConfig {
  if (!connectionString) throw new Error("DATABASE_URL is not configured");

  // A URL with three slashes has no network host. Use PostgreSQL's local Unix
  // socket so macOS/Homebrew peer authentication works without a fake password.
  if (/^postgres(?:ql)?:\/\/\//.test(connectionString)) {
    const url = new URL(connectionString);
    const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
    if (!database) throw new Error("DATABASE_URL must include a database name");
    return {
      host: process.env.PGHOST || "/tmp",
      database,
      user: decodeURIComponent(url.username) || process.env.PGUSER || userInfo().username,
      ...(url.port ? { port: Number(url.port) } : {}),
      ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
      max: 5,
    };
  }

  return { connectionString, max: 5 };
}

export function getPool() {
  pool ??= new Pool(databasePoolConfig());
  return pool;
}

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export async function saveCampaign(campaign: Campaign, brief: Record<string, unknown>) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const created = await client.query(
      `insert into campaigns (id, workspace_id, project_id, name, thesis, audience, brief)
       select $1, workspace_id, id, $3, $4, $5, $6 from projects
        where id = $2 and workspace_id = (select id from workspaces where slug = 'default')
       returning id`,
      [campaign.id, campaign.projectId, campaign.name, campaign.thesis, campaign.audience, brief],
    );
    if (!created.rowCount) throw new Error("The selected project no longer exists.");
    for (const post of campaign.posts) {
      await client.query(
        `insert into posts (
           id, campaign_id, workspace_id, social_account_id, platform, pillar,
           hook, body, cta, hashtags, media_brief, media_type, media_plan, media_items, media_url, media_key, status, scheduled_for
         ) values (
           $1, $2, (select id from workspaces where slug = 'default'),
           (select id from social_accounts where workspace_id = (select id from workspaces where slug = 'default') and platform = $3 order by updated_at desc limit 1),
           $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
         )`,
        [post.id, campaign.id, post.platform, post.pillar, post.hook, post.body, post.cta, post.hashtags,
          post.mediaBrief ?? null, post.mediaType, post.mediaPlan, JSON.stringify(post.mediaItems),
          post.mediaUrl ?? null, post.mediaKey ?? null, post.status, post.scheduledFor],
      );
    }
    await client.query("commit");
    return campaign.id;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getLatestCampaign(projectId: string): Promise<Campaign | null> {
  const campaignResult = await getPool().query(
    `select id, project_id, name, thesis, audience from campaigns
      where project_id = $1 and workspace_id = (select id from workspaces where slug = 'default')
      order by created_at desc limit 1`,
    [projectId],
  );
  const row = campaignResult.rows[0];
  if (!row) return null;
  const posts = await getPool().query(
    `select p.id, p.platform, p.pillar, p.hook, p.body, p.cta, p.hashtags, p.status, p.scheduled_for, p.media_brief,
            p.media_type, p.media_plan, p.media_items, p.media_url, p.media_key, p.remote_post_id, p.remote_post_url
            , p.social_account_id, a.display_name as destination_name, a.metadata ->> 'destinationType' as destination_type
       from posts p left join social_accounts a on a.id = p.social_account_id
       where p.campaign_id = $1 order by p.scheduled_for nulls last, p.created_at`,
    [row.id],
  );
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    thesis: row.thesis,
    audience: row.audience,
    posts: posts.rows.map((post) => ({
      id: post.id,
      platform: post.platform,
      pillar: post.pillar,
      hook: post.hook,
      body: post.body,
      cta: post.cta,
      hashtags: post.hashtags ?? [],
      status: post.status,
      scheduledFor: post.scheduled_for?.toISOString?.() ?? post.scheduled_for ?? null,
      mediaBrief: post.media_brief,
      mediaType: post.media_type,
      mediaPlan: post.media_plan ?? { frames: [], durationSeconds: 4 },
      mediaItems: post.media_items ?? [],
      mediaUrl: post.media_url,
      mediaKey: post.media_key,
      remotePostId: post.remote_post_id,
      remotePostUrl: post.remote_post_url,
      socialAccountId: post.social_account_id,
      destinationName: post.destination_name,
      destinationType: post.destination_type === "organization" ? "organization" : post.destination_name ? "person" : null,
    })),
  };
}

export async function approvePost(postId: string) {
  const result = await getPool().query(
    `update posts
        set status = 'approved'::post_status, failure_reason = null, updated_at = now()
      where id = $1 and status in ('draft', 'review')
      returning status`,
    [postId],
  );
  if (result.rows[0]) await audit(postId, "approved", {});
  return result.rows[0]?.status as string | undefined;
}

export async function updatePostContent(postId: string, content: { hook: string; body: string; cta: string; hashtags: string[] }) {
  const result = await getPool().query(
    `update posts
        set hook = $2, body = $3, cta = $4, hashtags = $5, updated_at = now()
      where id = $1 and status in ('draft', 'review', 'approved', 'scheduled', 'failed')
      returning hook, body, cta, hashtags`,
    [postId, content.hook, content.body, content.cta, content.hashtags],
  );
  const row = result.rows[0];
  if (row) await audit(postId, "copy_updated", { hashtagCount: row.hashtags?.length ?? 0 });
  return row ? { hook: String(row.hook), body: String(row.body), cta: String(row.cta), hashtags: (row.hashtags ?? []) as string[] } : null;
}

export async function createPostVariant(postId: string, platform: Platform): Promise<Campaign["posts"][number] | null> {
  const result = await getPool().query(
    `insert into posts (
       campaign_id, workspace_id, social_account_id, platform, pillar, hook, body, cta, hashtags,
       media_brief, media_type, media_plan, media_items, media_url, media_key, status
     )
     select p.campaign_id, p.workspace_id,
            (select a.id from social_accounts a
              join integrations i on i.id = a.integration_id and i.status = 'active'
             where a.workspace_id = p.workspace_id and a.platform = $2
             order by a.updated_at desc limit 1),
            $2::social_platform, p.pillar, p.hook, p.body, p.cta, p.hashtags,
            p.media_brief,
            case when $2 = 'instagram' and p.media_type = 'motion' then 'image' else p.media_type end,
            p.media_plan,
            case when $2 = 'instagram' and p.media_type = 'motion' then '[]'::jsonb else p.media_items end,
            case when $2 = 'instagram' and p.media_type = 'motion' then null else p.media_url end,
            case when $2 = 'instagram' and p.media_type = 'motion' then null else p.media_key end,
            'review'::post_status
       from posts p
      where p.id = $1
        and p.workspace_id = (select id from workspaces where slug = 'default')
        and p.status not in ('publishing')
      returning id, platform, pillar, hook, body, cta, hashtags, status, scheduled_for, media_brief,
                media_type, media_plan, media_items, media_url, media_key, social_account_id`,
    [postId, platform],
  );
  const row = result.rows[0];
  if (!row) return null;
  await audit(row.id, "variant_created", { sourcePostId: postId, platform });
  return {
    id: row.id,
    platform: row.platform,
    pillar: row.pillar,
    hook: row.hook,
    body: row.body,
    cta: row.cta,
    hashtags: row.hashtags ?? [],
    status: row.status,
    scheduledFor: row.scheduled_for?.toISOString?.() ?? row.scheduled_for ?? null,
    mediaBrief: row.media_brief,
    mediaType: row.media_type,
    mediaPlan: row.media_plan ?? { frames: [], durationSeconds: 4 },
    mediaItems: row.media_items ?? [],
    mediaUrl: row.media_url,
    mediaKey: row.media_key,
    socialAccountId: row.social_account_id,
  };
}

export async function scheduleApprovedPost(postId: string, scheduledFor: Date, socialAccountId?: string) {
  const result = await getPool().query(
    `update posts p
        set social_account_id = (
              select a.id from social_accounts a
               join integrations i on i.id = a.integration_id and i.status = 'active'
               where a.workspace_id = p.workspace_id and a.platform = p.platform
                 and ($3::uuid is null or a.id = $3::uuid)
               order by a.updated_at desc limit 1
            ),
            status = 'scheduled'::post_status,
            scheduled_for = $2,
            publishing_started_at = null,
            failure_reason = null,
            updated_at = now()
      where p.id = $1 and p.status in ('approved', 'scheduled', 'failed')
        and exists (
          select 1 from social_accounts a join integrations i on i.id = a.integration_id and i.status = 'active'
           where a.workspace_id = p.workspace_id and a.platform = p.platform
             and ($3::uuid is null or a.id = $3::uuid)
        )
      returning p.status, p.scheduled_for`,
    [postId, scheduledFor, socialAccountId ?? null],
  );
  const row = result.rows[0];
  if (row) await audit(postId, "scheduled", { scheduledFor: row.scheduled_for });
  return row ? { status: row.status as string, scheduledFor: row.scheduled_for as Date } : null;
}

export type PostImageContext = {
  postId: string;
  projectId: string;
  projectName: string;
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
  additionalContext: string;
  brandVoice: string;
  logoUrl: string | null;
  logoKey: string | null;
  platform: Platform;
  pillar: Campaign["posts"][number]["pillar"];
  hook: string;
  body: string;
  cta: string;
  mediaBrief: string | null;
  mediaType: MediaType;
  mediaPlan: MediaPlan;
  mediaItems: MediaAsset[];
  mediaKey: string | null;
  visualStyle: string | null;
};

export async function getPostImageContext(postId: string): Promise<PostImageContext | null> {
  const result = await getPool().query(
    `select p.id as post_id, p.platform, p.pillar, p.hook, p.body, p.cta, p.media_brief,
            p.media_type, p.media_plan, p.media_items, p.media_key,
            p.visual_style, pr.id as project_id, pr.name as project_name, pr.one_liner,
            pr.description, pr.problem_statement, pr.solution, pr.target_audience,
            pr.audience_pain_points, pr.use_cases, pr.key_features, pr.differentiators,
            pr.proof_points, pr.additional_context, pr.brand_voice, pr.logo_url, pr.logo_key
       from posts p
       join campaigns c on c.id = p.campaign_id
       join projects pr on pr.id = c.project_id
      where p.id = $1
        and p.workspace_id = (select id from workspaces where slug = 'default')
        and p.status in ('draft', 'review', 'approved', 'scheduled')`,
    [postId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    postId: row.post_id,
    projectId: row.project_id,
    projectName: row.project_name,
    oneLiner: row.one_liner,
    description: row.description,
    problemStatement: row.problem_statement,
    solution: row.solution,
    targetAudience: row.target_audience,
    audiencePainPoints: row.audience_pain_points,
    useCases: row.use_cases,
    keyFeatures: row.key_features ?? [],
    differentiators: row.differentiators,
    proofPoints: row.proof_points,
    additionalContext: row.additional_context,
    brandVoice: row.brand_voice,
    logoUrl: row.logo_url,
    logoKey: row.logo_key,
    platform: row.platform,
    pillar: row.pillar,
    hook: row.hook,
    body: row.body,
    cta: row.cta,
    mediaBrief: row.media_brief,
    mediaType: row.media_type,
    mediaPlan: row.media_plan ?? { frames: [], durationSeconds: 4 },
    mediaItems: row.media_items ?? [],
    mediaKey: row.media_key,
    visualStyle: row.visual_style,
  };
}

export async function getRecentVisualStyles(projectId: string, excludePostId: string, limit = 8) {
  const result = await getPool().query(
    `select p.visual_style
       from posts p join campaigns c on c.id=p.campaign_id
      where c.project_id=$1 and p.id<>$2 and p.visual_style is not null
      order by p.updated_at desc limit $3`,
    [projectId, excludePostId, limit],
  );
  return result.rows.map((row) => String(row.visual_style));
}

export async function setPostMedia(
  postId: string,
  media: { mediaUrl: string; mediaKey: string; mediaType: MediaType; mediaItems: MediaAsset[] },
  visual?: { styleId: string; direction: Record<string, unknown> },
) {
  const result = await getPool().query(
    `update posts set media_url = $2, media_key = $3, media_type = $4, media_items = $5,
        visual_style = coalesce($6, visual_style), visual_direction = coalesce($7, visual_direction), updated_at = now()
      where id = $1 and status in ('draft', 'review', 'approved', 'scheduled')
      returning media_key`,
    [postId, media.mediaUrl, media.mediaKey, media.mediaType, JSON.stringify(media.mediaItems),
      visual?.styleId ?? null, visual?.direction ?? null],
  );
  return Boolean(result.rowCount);
}

export type AIUsageKind = "campaign" | "image";

export async function reserveAIUsage(kind: AIUsageKind, limit: number) {
  if (!Number.isInteger(limit) || limit < 1) return false;
  const column = kind === "campaign" ? "campaign_count" : "image_count";
  const result = await getPool().query(
    `insert into ai_daily_usage (workspace_id, usage_date, ${column})
     values ((select id from workspaces where slug = 'default'), (now() at time zone 'UTC')::date, 1)
     on conflict (workspace_id, usage_date) do update
       set ${column} = ai_daily_usage.${column} + 1,
           updated_at = now()
       where ai_daily_usage.${column} < $1
     returning ${column}`,
    [limit],
  );
  return Boolean(result.rowCount);
}

export async function releaseAIUsage(kind: AIUsageKind) {
  const column = kind === "campaign" ? "campaign_count" : "image_count";
  await getPool().query(
    `update ai_daily_usage set ${column} = greatest(${column} - 1, 0), updated_at = now()
      where workspace_id = (select id from workspaces where slug = 'default')
        and usage_date = (now() at time zone 'UTC')::date`,
  );
}

export type TokenSet = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes: string[];
  providerAccountId: string;
  displayName?: string;
  metadata?: Record<string, unknown>;
};

export async function saveSocialAccount(platform: Platform, tokenSet: TokenSet) {
  const accessCiphertext = await encryptSecret(tokenSet.accessToken);
  const refreshCiphertext = tokenSet.refreshToken ? await encryptSecret(tokenSet.refreshToken) : null;
  const result = await getPool().query(
    `insert into social_accounts (
       workspace_id, platform, provider_account_id, display_name, access_token_ciphertext,
       refresh_token_ciphertext, token_expires_at, scopes, metadata
     ) values (
       (select id from workspaces where slug = 'default'), $1, $2, $3, $4, $5, $6, $7, $8
     ) on conflict (workspace_id, platform, provider_account_id) do update set
       display_name = excluded.display_name,
       access_token_ciphertext = excluded.access_token_ciphertext,
       refresh_token_ciphertext = excluded.refresh_token_ciphertext,
       token_expires_at = excluded.token_expires_at,
       scopes = excluded.scopes,
       metadata = excluded.metadata,
       updated_at = now()
     returning id`,
    [platform, tokenSet.providerAccountId, tokenSet.displayName ?? null, accessCiphertext, refreshCiphertext, tokenSet.expiresAt ?? null, tokenSet.scopes, tokenSet.metadata ?? {}],
  );
  return result.rows[0].id as string;
}

export type DuePost = {
  id: string;
  integrationId: string | null;
  platform: Platform;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  mediaType: MediaType;
  mediaItems: MediaAsset[];
  mediaUrl: string | null;
  accessToken: string;
  tokenExpiresAt: Date | null;
  providerAccountId: string;
  accountMetadata: Record<string, unknown>;
  accountScopes: string[];
  accountDisplayName: string;
  socialAccountId: string;
};

async function duePostFromRow(row: Record<string, unknown>): Promise<DuePost> {
  return {
    id: String(row.id),
    integrationId: row.integration_id ? String(row.integration_id) : null,
    platform: row.platform as Platform,
    hook: String(row.hook),
    body: String(row.body),
    cta: String(row.cta),
    hashtags: (row.hashtags ?? []) as string[],
    mediaType: row.media_type as MediaType,
    mediaItems: (row.media_items ?? []) as MediaAsset[],
    mediaUrl: row.media_url ? String(row.media_url) : null,
    accessToken: await decryptSecret(String(row.access_token_ciphertext)),
    tokenExpiresAt: row.token_expires_at as Date | null,
    providerAccountId: String(row.provider_account_id),
    accountMetadata: (row.metadata ?? {}) as Record<string, unknown>,
    accountScopes: (row.scopes ?? []) as string[],
    accountDisplayName: String(row.display_name ?? row.provider_account_id),
    socialAccountId: String(row.social_account_id),
  };
}

export async function claimPostNow(postId: string, socialAccountId?: string): Promise<DuePost | null> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const claimed = await client.query(
      `update posts p
          set social_account_id = (
                select a.id from social_accounts a
                 join integrations i on i.id = a.integration_id and i.status = 'active'
                 where a.workspace_id = p.workspace_id and a.platform = p.platform
                   and ($2::uuid is null or a.id = $2::uuid)
                 order by a.updated_at desc limit 1
              ),
              status = 'publishing'::post_status,
              scheduled_for = now(),
              publishing_started_at = now(),
              attempts = attempts + 1,
              failure_reason = null,
              updated_at = now()
        where p.id = $1 and p.status in ('approved', 'scheduled', 'failed')
          and exists (
            select 1 from social_accounts a join integrations i on i.id = a.integration_id and i.status = 'active'
             where a.workspace_id = p.workspace_id and a.platform = p.platform
               and ($2::uuid is null or a.id = $2::uuid)
          )
        returning p.id`,
      [postId, socialAccountId ?? null],
    );
    if (!claimed.rowCount) { await client.query("rollback"); return null; }
    const result = await client.query(
      `select p.id, p.platform, p.hook, p.body, p.cta, p.hashtags, p.media_type, p.media_items, p.media_url,
              a.integration_id, a.access_token_ciphertext, a.token_expires_at,
              a.id as social_account_id, a.provider_account_id, a.display_name, a.scopes, a.metadata
         from posts p join social_accounts a on a.id = p.social_account_id
        where p.id = $1`,
      [postId],
    );
    await client.query("commit");
    return result.rows[0] ? duePostFromRow(result.rows[0]) : null;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally { client.release(); }
}

export async function claimDuePosts(limit = 10): Promise<DuePost[]> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await client.query(
      `select p.id, p.platform, p.hook, p.body, p.cta, p.hashtags, p.media_type, p.media_items, p.media_url,
              a.integration_id, a.access_token_ciphertext, a.token_expires_at,
              a.id as social_account_id, a.provider_account_id, a.display_name, a.scopes, a.metadata
         from posts p
         join social_accounts a on a.id = p.social_account_id
        where p.status = 'scheduled' and p.scheduled_for <= now()
        order by p.scheduled_for asc
        for update of p skip locked
        limit $1`,
      [limit],
    );
    if (result.rowCount) {
      await client.query(
        `update posts set status = 'publishing', publishing_started_at = now(), attempts = attempts + 1, updated_at = now()
          where id = any($1::uuid[])`,
        [result.rows.map((row) => row.id)],
      );
    }
    await client.query("commit");
    return Promise.all(result.rows.map(duePostFromRow));
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function finishPublishing(postId: string, result: { remotePostId: string; remotePostUrl?: string }) {
  await getPool().query(
    `update posts set status = 'published', remote_post_id = $2, remote_post_url = $3,
       published_at = now(), failure_reason = null, updated_at = now() where id = $1`,
    [postId, result.remotePostId, result.remotePostUrl ?? null],
  );
  await audit(postId, "published", { remotePostId: result.remotePostId });
}

export async function failPublishing(postId: string, reason: string, status: "approved" | "failed" = "failed") {
  await getPool().query(
    `update posts set
       status = $3::post_status,
       failure_reason = $2,
       publishing_started_at = null,
       scheduled_for = case when $3::post_status = 'approved'::post_status then null else scheduled_for end,
       updated_at = now()
     where id = $1`,
    [postId, reason.slice(0, 1000), status],
  );
  await audit(postId, "failed", { reason: reason.slice(0, 500), restoredStatus: status });
}

async function audit(postId: string, eventType: string, detail: Record<string, unknown>, client?: PoolClient) {
  await (client ?? getPool()).query(
    "insert into publishing_events (post_id, event_type, detail) values ($1, $2, $3)",
    [postId, eventType, detail],
  );
}
