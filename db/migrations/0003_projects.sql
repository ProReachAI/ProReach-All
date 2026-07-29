create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  website_url text,
  one_liner text not null,
  description text not null,
  problem_statement text not null,
  solution text not null,
  target_audience text not null,
  audience_pain_points text not null,
  use_cases text not null default '',
  key_features text[] not null default '{}',
  differentiators text not null,
  proof_points text not null,
  competitors text not null default '',
  brand_voice text not null,
  tone_guidelines text not null default '',
  words_to_use text[] not null default '{}',
  words_to_avoid text[] not null default '{}',
  primary_goal text not null,
  primary_cta text not null,
  additional_context text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create index if not exists projects_workspace_idx on projects (workspace_id, updated_at desc);

alter table campaigns
  add column if not exists project_id uuid references projects(id) on delete cascade;

create index if not exists campaigns_project_idx on campaigns (project_id, created_at desc);

do $$
begin
  if not exists (select 1 from campaigns where project_id is null) then
    alter table campaigns alter column project_id set not null;
  end if;
end $$;
