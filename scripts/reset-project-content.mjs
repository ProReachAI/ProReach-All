import { userInfo } from "node:os";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import pg from "pg";

const { Pool } = pg;
const args = process.argv.slice(2);
const projectNameIndex = args.indexOf("--project-name");
const projectName = projectNameIndex >= 0 ? args[projectNameIndex + 1]?.trim() : "";
const confirmed = args.includes("--confirm");

if (!projectName) throw new Error("Pass the exact project name with --project-name.");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");

function poolConfig(connectionString) {
  if (!/^postgres(?:ql)?:\/\/\//.test(connectionString)) return { connectionString, max: 2 };
  const url = new URL(connectionString);
  return {
    host: process.env.PGHOST || "/tmp",
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    user: decodeURIComponent(url.username) || process.env.PGUSER || userInfo().username,
    ...(url.port ? { port: Number(url.port) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    max: 2,
  };
}

const pool = new Pool(poolConfig(process.env.DATABASE_URL));
const projects = await pool.query(
  `select id, name from projects
    where workspace_id = (select id from workspaces where slug='default')
      and lower(name)=lower($1)`,
  [projectName],
);
if (projects.rowCount !== 1) throw new Error(`Expected exactly one project named "${projectName}"; found ${projects.rowCount}.`);
const project = projects.rows[0];

const content = await pool.query(
  `select count(distinct c.id)::int as campaigns,
          count(p.id)::int as posts,
          count(*) filter (where p.status='published')::int as published_rows
     from campaigns c left join posts p on p.campaign_id=c.id
    where c.project_id=$1`,
  [project.id],
);
const keys = await pool.query(
  `select distinct key from (
     select p.media_key as key
       from posts p join campaigns c on c.id=p.campaign_id where c.project_id=$1
     union all
     select item->>'key' as key
       from posts p join campaigns c on c.id=p.campaign_id
       cross join lateral jsonb_array_elements(p.media_items) item
      where c.project_id=$1
   ) media where key is not null`,
  [project.id],
);

const summary = {
  projectId: project.id,
  projectName: project.name,
  campaigns: content.rows[0].campaigns,
  posts: content.rows[0].posts,
  publishedHistoryRows: content.rows[0].published_rows,
  generatedMediaObjects: keys.rowCount,
};

if (!confirmed) {
  console.log(JSON.stringify({ mode: "dry-run", ...summary }, null, 2));
  await pool.end();
  process.exit(0);
}

const guardrail = "ProPhrase is a complete software-only communication tool. It has no hardware, device, gadget, wearable, robot, physical product, sensor, accessory, packaging, or machine component. Marketing copy and visuals must stay grounded in verified software workflows: workplace message rewriting, tone selection, clearer wording, before-and-after communication, and the saved product features and use cases.";
const client = await pool.connect();
try {
  await client.query("begin");
  const deletedPosts = await client.query(
    `delete from posts where campaign_id in (select id from campaigns where project_id=$1) returning id`,
    [project.id],
  );
  const deletedCampaigns = await client.query(`delete from campaigns where project_id=$1 returning id`, [project.id]);
  await client.query(
    `update projects set additional_context = case
       when additional_context ilike '%complete software-only communication tool%' then additional_context
       when trim(additional_context) = '' then $2
       else trim(additional_context) || E'\n\n' || $2
     end, updated_at=now() where id=$1`,
    [project.id, guardrail],
  );
  await client.query("commit");
  summary.posts = deletedPosts.rowCount;
  summary.campaigns = deletedCampaigns.rowCount;
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}

const r2 = {
  accountId: process.env.R2_ACCOUNT_ID ?? process.env.CLOUDFLARE_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET,
};
let removedMediaObjects = 0;
const mediaCleanupErrors = [];
if (keys.rowCount && Object.values(r2).every(Boolean)) {
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
  });
  for (const row of keys.rows) {
    const key = String(row.key);
    if (!key.startsWith(`generated/${project.id}/`)) {
      mediaCleanupErrors.push(`Refused unexpected key: ${key}`);
      continue;
    }
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: r2.bucket, Key: key }));
      removedMediaObjects += 1;
    } catch (error) {
      mediaCleanupErrors.push(error instanceof Error ? error.message : `Could not delete ${key}`);
    }
  }
} else if (keys.rowCount) {
  mediaCleanupErrors.push("R2 is not fully configured; database rows were reset but generated media could not be removed.");
}

console.log(JSON.stringify({ mode: "confirmed", ...summary, removedMediaObjects, mediaCleanupErrors }, null, 2));
