-- Keep every Page/profile discovered by OAuth while allowing the workspace to
-- explicitly choose which destinations are enabled for publishing.

alter table social_accounts
  add column if not exists enabled boolean not null default true;

create index if not exists social_accounts_enabled_idx
  on social_accounts (integration_id, enabled);
