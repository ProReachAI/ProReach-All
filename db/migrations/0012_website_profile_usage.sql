alter table ai_daily_usage
  add column if not exists profile_count integer not null default 0 check (profile_count >= 0);

