import type { PoolClient } from "pg";
import { getPool } from "@/lib/db";

type Queryable = Pick<PoolClient, "query">;

export async function ensureUserWorkspace(userId: string, displayName = "ProReach workspace", queryable: Queryable = getPool()) {
  const result = await queryable.query(
    `insert into workspaces (name, slug, owner_user_id)
     values ($2, 'user-' || $1::text, $1::uuid)
     on conflict (owner_user_id) do update
       set name = case when workspaces.name = 'Builder workspace' then excluded.name else workspaces.name end
     returning id`,
    [userId, displayName.trim() ? `${displayName.trim()}'s workspace` : "ProReach workspace"],
  );
  return String(result.rows[0].id);
}

export async function userOwnsProject(userId: string, projectId: string, queryable: Queryable = getPool()) {
  const result = await queryable.query(
    `select p.id
       from projects p
       join workspaces w on w.id = p.workspace_id
      where p.id = $2::uuid and w.owner_user_id = $1::uuid`,
    [userId, projectId],
  );
  return Boolean(result.rowCount);
}
