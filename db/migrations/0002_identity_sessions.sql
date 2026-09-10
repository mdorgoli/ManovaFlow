create table if not exists oidc_identities (
  issuer text not null check (length(issuer) between 1 and 2048),
  subject text not null check (length(subject) between 1 and 512),
  actor_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (issuer, subject)
);

create table if not exists auth_sessions (
  id uuid primary key,
  tenant_id uuid not null,
  actor_id uuid not null,
  issuer text not null,
  subject text not null,
  state text not null check (state in ('ACTIVE', 'REVOKED', 'COMPROMISED', 'EXPIRED')),
  mfa_method text not null check (length(mfa_method) between 1 and 160),
  mfa_verified_at timestamptz not null,
  mfa_expires_at timestamptz not null,
  issued_at timestamptz not null,
  last_seen_at timestamptz not null,
  expires_at timestamptz not null,
  rotation_counter integer not null default 0 check (rotation_counter >= 0),
  revoked_at timestamptz,
  foreign key (tenant_id, actor_id)
    references memberships(tenant_id, actor_id) on delete cascade,
  foreign key (issuer, subject)
    references oidc_identities(issuer, subject) on delete restrict,
  check (expires_at > issued_at),
  check (mfa_expires_at > mfa_verified_at)
);

create table if not exists auth_session_credentials (
  token_hash char(64) primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  session_id uuid not null references auth_sessions(id) on delete cascade,
  generation integer not null check (generation >= 0),
  csrf_hash char(64) not null check (csrf_hash ~ '^[0-9a-f]{64}$'),
  state text not null check (state in ('ACTIVE', 'ROTATED', 'REVOKED')),
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  unique (session_id, generation),
  check (expires_at > issued_at)
);

create table if not exists consumed_oidc_tokens (
  token_hash char(64) primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  issuer text not null,
  subject text not null,
  consumed_at timestamptz not null,
  expires_at timestamptz not null,
  foreign key (issuer, subject)
    references oidc_identities(issuer, subject) on delete cascade,
  check (expires_at > consumed_at)
);

create index if not exists auth_sessions_actor_tenant_idx
  on auth_sessions (actor_id, tenant_id, state);
create index if not exists auth_sessions_expiry_idx
  on auth_sessions (expires_at) where state = 'ACTIVE';
create index if not exists auth_session_credentials_session_idx
  on auth_session_credentials (session_id, generation desc);
create index if not exists consumed_oidc_tokens_expiry_idx
  on consumed_oidc_tokens (expires_at);

revoke all on table oidc_identities from public;
revoke all on table auth_sessions from public;
revoke all on table auth_session_credentials from public;
revoke all on table consumed_oidc_tokens from public;
revoke all on table oidc_identities from manovaflow_app;
revoke all on table auth_sessions from manovaflow_app;
revoke all on table auth_session_credentials from manovaflow_app;
revoke all on table consumed_oidc_tokens from manovaflow_app;

