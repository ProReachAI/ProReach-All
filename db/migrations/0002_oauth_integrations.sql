-- Upgrade the original MVP schema to the provider-grant/account model.
-- Safe to run once against an existing database created from the original schema.

alter type social_platform add value if not exists 'facebook';

do $$ begin
  create type integration_provider as enum ('meta', 'threads', 'x', 'linkedin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type integration_status as enum ('active', 'expired', 'revoked', 'error');
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

alter table social_accounts
  add column if not exists integration_id uuid references integrations(id) on delete cascade;

create index if not exists social_accounts_integration_idx on social_accounts (integration_id);
