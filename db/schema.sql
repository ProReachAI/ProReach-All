create extension if not exists pgcrypto;

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

insert into workspaces (name, slug)
values ('Builder workspace', 'default')
on conflict (slug) do nothing;

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  website_url text,
  logo_url text,
  logo_key text,
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
create unique index if not exists projects_workspace_name_ci_uidx on projects (workspace_id, lower(name));

do $$ begin
  create type social_platform as enum ('facebook', 'instagram', 'threads', 'x', 'linkedin');
exception when duplicate_object then null;
end $$;

alter type social_platform add value if not exists 'facebook';

do $$ begin
  create type integration_provider as enum ('meta', 'instagram', 'threads', 'x', 'linkedin');
exception when duplicate_object then null;
end $$;

alter type integration_provider add value if not exists 'instagram';

do $$ begin
  create type integration_status as enum ('active', 'expired', 'revoked', 'error');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type post_status as enum ('draft', 'review', 'approved', 'scheduled', 'publishing', 'published', 'failed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type content_pillar as enum ('makeover', 'insight', 'building', 'proof');
exception when duplicate_object then null;
end $$;

create table if not exists integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  provider integration_provider not null,
  provider_user_id text not null,
  display_name text,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text,
  token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scopes text[] not null default '{}',
  status integration_status not null default 'active',
  last_error text,
  last_verified_at timestamptz,
  metadata jsonb not null default '{}',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider, provider_user_id)
);

create table if not exists oauth_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  provider integration_provider not null,
  state_hash text not null unique,
  binding_hash text not null,
  pkce_verifier_ciphertext text,
  return_to text not null default '/dashboard?view=connections',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists oauth_sessions_expiry_idx on oauth_sessions (expires_at);

create table if not exists social_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  integration_id uuid references integrations(id) on delete cascade,
  platform social_platform not null,
  provider_account_id text not null,
  display_name text,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  metadata jsonb not null default '{}',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, platform, provider_account_id)
);

alter table social_accounts add column if not exists integration_id uuid references integrations(id) on delete cascade;
create index if not exists social_accounts_integration_idx on social_accounts (integration_id);

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  thesis text not null,
  audience text not null,
  brief jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists campaigns_project_idx on campaigns (project_id, created_at desc);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete set null,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  social_account_id uuid references social_accounts(id) on delete set null,
  platform social_platform not null,
  pillar content_pillar not null,
  hook text not null,
  body text not null,
  cta text not null default '',
  hashtags text[] not null default '{}',
  media_brief text,
  media_type text not null default 'image' check (media_type in ('image', 'carousel', 'motion')),
  media_plan jsonb not null default '{"frames":[],"durationSeconds":4}'::jsonb,
  media_items jsonb not null default '[]'::jsonb,
  media_url text,
  media_key text,
  visual_style text,
  visual_direction jsonb,
  status post_status not null default 'draft',
  scheduled_for timestamptz,
  publishing_started_at timestamptz,
  published_at timestamptz,
  remote_post_id text,
  remote_post_url text,
  failure_reason text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_due_idx
  on posts (scheduled_for)
  where status = 'scheduled';

create table if not exists ai_daily_usage (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  usage_date date not null,
  campaign_count integer not null default 0 check (campaign_count >= 0),
  image_count integer not null default 0 check (image_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, usage_date)
);

create table if not exists publishing_events (
  id bigserial primary key,
  post_id uuid not null references posts(id) on delete cascade,
  event_type text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists daily_metrics (
  id bigserial primary key,
  post_id uuid not null references posts(id) on delete cascade,
  metric_date date not null,
  impressions integer,
  reactions integer,
  comments integer,
  shares integer,
  clicks integer,
  raw jsonb not null default '{}',
  unique (post_id, metric_date)
);
