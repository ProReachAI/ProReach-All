begin;

with ranked as (
  select id,
         first_value(id) over (
           partition by workspace_id, lower(name)
           order by updated_at desc, created_at desc, id desc
         ) as keep_id,
         row_number() over (
           partition by workspace_id, lower(name)
           order by updated_at desc, created_at desc, id desc
         ) as duplicate_rank
    from projects
)
update campaigns c
   set project_id = ranked.keep_id
  from ranked
 where c.project_id = ranked.id
   and ranked.duplicate_rank > 1;

with ranked as (
  select id,
         row_number() over (
           partition by workspace_id, lower(name)
           order by updated_at desc, created_at desc, id desc
         ) as duplicate_rank
    from projects
)
delete from projects p
 using ranked
 where p.id = ranked.id
   and ranked.duplicate_rank > 1;

create unique index if not exists projects_workspace_name_ci_uidx
  on projects (workspace_id, lower(name));

commit;
