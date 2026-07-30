import { z } from "zod";
import { getPool } from "@/lib/db";
import type { ProductProject } from "@/lib/types";
import { ensureUserWorkspace } from "@/lib/workspaces";

const optionalUrl = z.union([z.literal(""), z.string().url().max(500)]).transform((value) => value || null);
const shortList = z.array(z.string().trim().min(1).max(120)).max(20).default([]);

export const ProjectInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  websiteUrl: optionalUrl.default(""),
  oneLiner: z.string().trim().min(10).max(240),
  description: z.string().trim().min(30).max(3000),
  problemStatement: z.string().trim().min(20).max(2000),
  solution: z.string().trim().min(20).max(2000),
  targetAudience: z.string().trim().min(20).max(2000),
  audiencePainPoints: z.string().trim().min(20).max(2000),
  useCases: z.string().trim().max(2000).default(""),
  keyFeatures: shortList.refine((items) => items.length > 0, "Add at least one key feature."),
  differentiators: z.string().trim().min(20).max(2000),
  proofPoints: z.string().trim().min(10).max(2500),
  competitors: z.string().trim().max(1000).default(""),
  brandVoice: z.string().trim().min(10).max(1000),
  toneGuidelines: z.string().trim().max(1500).default(""),
  wordsToUse: shortList,
  wordsToAvoid: shortList,
  primaryGoal: z.string().trim().min(10).max(1000),
  primaryCta: z.string().trim().min(5).max(500),
  additionalContext: z.string().trim().max(3000).default(""),
});

export type ProjectInput = z.infer<typeof ProjectInputSchema>;

function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "project";
}

function mapProject(row: Record<string, unknown>): ProductProject {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    websiteUrl: row.website_url ? String(row.website_url) : null,
    logoUrl: row.logo_url ? String(row.logo_url) : null,
    logoKey: row.logo_key ? String(row.logo_key) : null,
    oneLiner: String(row.one_liner),
    description: String(row.description),
    problemStatement: String(row.problem_statement),
    solution: String(row.solution),
    targetAudience: String(row.target_audience),
    audiencePainPoints: String(row.audience_pain_points),
    useCases: String(row.use_cases ?? ""),
    keyFeatures: (row.key_features as string[] | null) ?? [],
    differentiators: String(row.differentiators),
    proofPoints: String(row.proof_points),
    competitors: String(row.competitors ?? ""),
    brandVoice: String(row.brand_voice),
    toneGuidelines: String(row.tone_guidelines ?? ""),
    wordsToUse: (row.words_to_use as string[] | null) ?? [],
    wordsToAvoid: (row.words_to_avoid as string[] | null) ?? [],
    primaryGoal: String(row.primary_goal),
    primaryCta: String(row.primary_cta),
    additionalContext: String(row.additional_context ?? ""),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

const columns = `id, name, slug, website_url, logo_url, logo_key, one_liner, description, problem_statement,
  solution, target_audience, audience_pain_points, use_cases, key_features,
  differentiators, proof_points, competitors, brand_voice, tone_guidelines,
  words_to_use, words_to_avoid, primary_goal, primary_cta, additional_context,
  created_at, updated_at`;

export async function listProjects(userId: string, displayName?: string) {
  const workspaceId = await ensureUserWorkspace(userId, displayName);
  const result = await getPool().query(
    `select ${columns} from (
       select distinct on (lower(name)) ${columns}
         from projects
        where workspace_id = $1
        order by lower(name), updated_at desc
     ) deduplicated
     order by updated_at desc`,
    [workspaceId],
  );
  return result.rows.map(mapProject);
}

export async function setProjectLogo(userId: string, id: string, logoUrl: string, logoKey: string) {
  const result = await getPool().query(
    `update projects set logo_url=$2, logo_key=$3, updated_at=now()
      where id=$1 and workspace_id=(select id from workspaces where owner_user_id=$4::uuid)
      returning ${columns}`,
    [id, logoUrl, logoKey, userId],
  );
  return result.rows[0] ? mapProject(result.rows[0]) : undefined;
}

export async function getProject(userId: string, id: string) {
  const result = await getPool().query(
    `select ${columns} from projects
      where id = $1 and workspace_id = (select id from workspaces where owner_user_id = $2::uuid)`,
    [id, userId],
  );
  return result.rows[0] ? mapProject(result.rows[0]) : undefined;
}

function values(input: ProjectInput) {
  return [
    input.name, input.websiteUrl, input.oneLiner, input.description, input.problemStatement,
    input.solution, input.targetAudience, input.audiencePainPoints, input.useCases,
    input.keyFeatures, input.differentiators, input.proofPoints, input.competitors,
    input.brandVoice, input.toneGuidelines, input.wordsToUse, input.wordsToAvoid,
    input.primaryGoal, input.primaryCta, input.additionalContext,
  ];
}

export async function createProject(userId: string, displayName: string, raw: unknown) {
  const input = ProjectInputSchema.parse(raw);
  const workspaceId = await ensureUserWorkspace(userId, displayName);
  const existing = await getPool().query(
    `select ${columns} from projects
      where workspace_id = $2
        and lower(name) = lower($1)
      order by updated_at desc limit 1`,
    [input.name, workspaceId],
  );
  if (existing.rows[0]) return mapProject(existing.rows[0]);
  const base = slugify(input.name);
  let slug = base;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const result = await getPool().query(
      `insert into projects (
        workspace_id, name, slug, website_url, one_liner, description, problem_statement,
        solution, target_audience, audience_pain_points, use_cases, key_features,
        differentiators, proof_points, competitors, brand_voice, tone_guidelines,
        words_to_use, words_to_avoid, primary_goal, primary_cta, additional_context
      ) values ($22, $1, $21, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      on conflict do nothing returning ${columns}`,
      [...values(input), slug, workspaceId],
    );
    if (result.rows[0]) return mapProject(result.rows[0]);
    const concurrent = await getPool().query(
      `select ${columns} from projects
        where workspace_id = $2
          and lower(name) = lower($1)
        order by updated_at desc limit 1`,
      [input.name, workspaceId],
    );
    if (concurrent.rows[0]) return mapProject(concurrent.rows[0]);
    slug = `${base}-${attempt + 2}`;
  }
  throw new Error("Could not create a unique project slug.");
}

export async function updateProject(userId: string, id: string, raw: unknown) {
  const input = ProjectInputSchema.parse(raw);
  const result = await getPool().query(
    `update projects set
      name=$2, website_url=$3, one_liner=$4, description=$5, problem_statement=$6,
      solution=$7, target_audience=$8, audience_pain_points=$9, use_cases=$10,
      key_features=$11, differentiators=$12, proof_points=$13, competitors=$14,
      brand_voice=$15, tone_guidelines=$16, words_to_use=$17, words_to_avoid=$18,
      primary_goal=$19, primary_cta=$20, additional_context=$21, updated_at=now()
      where id=$1 and workspace_id=(select id from workspaces where owner_user_id=$22::uuid)
      returning ${columns}`,
    [id, ...values(input), userId],
  );
  return result.rows[0] ? mapProject(result.rows[0]) : undefined;
}
