begin;

alter table workspaces add column if not exists owner_user_id uuid;

-- Preserve the existing owner's data when this database already contains the
-- original single "default" workspace. New users receive separate workspaces.
do $$
begin
  if to_regclass('auth.users') is not null then
    update workspaces
       set owner_user_id = (
         select id from auth.users
          where lower(email) = lower('nagapavan009@gmail.com')
          order by created_at asc limit 1
       )
     where slug = 'default'
       and owner_user_id is null
       and exists (
         select 1 from auth.users
          where lower(email) = lower('nagapavan009@gmail.com')
       );
  end if;
end $$;

create unique index if not exists workspaces_owner_user_uidx
  on workspaces (owner_user_id);

alter table integrations add column if not exists project_id uuid references projects(id) on delete cascade;
alter table oauth_sessions add column if not exists project_id uuid references projects(id) on delete cascade;
alter table social_accounts add column if not exists project_id uuid references projects(id) on delete cascade;

-- Existing connections predate project isolation. Attach them to the first
-- project in their workspace; users can reconnect them under another project.
update integrations i
   set project_id = (
     select p.id from projects p
      where p.workspace_id = i.workspace_id
      order by p.created_at asc, p.id asc limit 1
   )
 where i.project_id is null;

update social_accounts a
   set project_id = coalesce(
     (select i.project_id from integrations i where i.id = a.integration_id),
     (select p.id from projects p where p.workspace_id = a.workspace_id order by p.created_at asc, p.id asc limit 1)
   )
 where a.project_id is null;

delete from oauth_sessions;

alter table oauth_sessions alter column project_id set not null;

alter table integrations drop constraint if exists integrations_workspace_id_provider_provider_user_id_key;
alter table social_accounts drop constraint if exists social_accounts_workspace_id_platform_provider_account_id_key;

create unique index if not exists integrations_project_provider_user_uidx
  on integrations (project_id, provider, provider_user_id)
  where project_id is not null;
create unique index if not exists social_accounts_project_platform_account_uidx
  on social_accounts (project_id, platform, provider_account_id)
  where project_id is not null;

create index if not exists integrations_project_idx on integrations (project_id, updated_at desc);
create index if not exists oauth_sessions_project_idx on oauth_sessions (project_id, expires_at);
create index if not exists social_accounts_project_idx on social_accounts (project_id, platform, enabled);

do $$
begin
  if not exists (select 1 from integrations where project_id is null) then
    alter table integrations alter column project_id set not null;
  end if;
  if not exists (select 1 from social_accounts where project_id is null) then
    alter table social_accounts alter column project_id set not null;
  end if;
end $$;

-- These tables are accessed by the server through DATABASE_URL. Enabling RLS
-- without public policies prevents accidental access through the Supabase anon
-- or publishable key; the direct postgres server connection remains in control.
alter table workspaces enable row level security;
alter table projects enable row level security;
alter table integrations enable row level security;
alter table oauth_sessions enable row level security;
alter table social_accounts enable row level security;
alter table campaigns enable row level security;
alter table posts enable row level security;
alter table ai_daily_usage enable row level security;
alter table publishing_events enable row level security;
alter table daily_metrics enable row level security;

commit;
