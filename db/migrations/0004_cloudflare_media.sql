alter table posts add column if not exists media_brief text;
alter table posts add column if not exists media_key text;

create table if not exists ai_daily_usage (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  usage_date date not null,
  campaign_count integer not null default 0 check (campaign_count >= 0),
  image_count integer not null default 0 check (image_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, usage_date)
);
