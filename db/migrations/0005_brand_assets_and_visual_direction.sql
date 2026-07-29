alter table projects add column if not exists logo_url text;
alter table projects add column if not exists logo_key text;

alter table posts add column if not exists visual_style text;
alter table posts add column if not exists visual_direction jsonb;

create index if not exists posts_project_visual_style_idx
  on posts (visual_style, created_at desc)
  where visual_style is not null;
