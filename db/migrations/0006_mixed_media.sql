alter table posts add column if not exists media_type text not null default 'image';
alter table posts add column if not exists media_plan jsonb not null default '{"frames":[],"durationSeconds":4}'::jsonb;
alter table posts add column if not exists media_items jsonb not null default '[]'::jsonb;

do $$ begin
  alter table posts add constraint posts_media_type_check
    check (media_type in ('image', 'carousel', 'motion'));
exception when duplicate_object then null;
end $$;
